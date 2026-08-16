import logger from '../config/logger.js';
import AlertService, { SEVERITY } from '../services/alertService.js';
import {
    classifyUserAgent,
    resolveRequestRoute,
} from '../services/requestObservability.js';
import { recordRequest } from '../services/systemMetricService.js';

const notifyWithoutBlocking = (message, context, severity) => {
    void AlertService.notify(new Error(message), context, severity).catch((error) => {
        logger.error('Operational alert scheduling failed.', {
            event: 'alert_scheduling_failed',
            errorCode: error?.code || 'ALERT_SCHEDULING_FAILED',
            alertKey: context.alertKey,
        });
    });
};

const emitHttpSignals = ({ method, route, statusCode, durationMs, correlationId }) => {
    if (durationMs > 2000) {
        notifyWithoutBlocking('HTTP request exceeded the critical latency threshold.', {
            alertKey: `HTTP_SLOW:${method}:${route}`,
            component: 'API_PERFORMANCE',
            event: 'SLOW_REQUEST',
            method,
            route,
            statusCode,
            durationMs,
            correlationId,
        }, SEVERITY.WARNING);
    }

    if (statusCode === 429) {
        notifyWithoutBlocking('HTTP rate limit was reached.', {
            alertKey: `HTTP_RATE_LIMIT:${method}:${route}`,
            component: 'API_SECURITY',
            event: 'RATE_LIMITED',
            method,
            route,
            statusCode,
            correlationId,
        }, SEVERITY.WARNING);
    } else if ((statusCode === 401 || statusCode === 403) && route.startsWith('/api/auth')) {
        notifyWithoutBlocking('Authentication request was denied.', {
            alertKey: `AUTH_DENIED:${method}:${route}:${statusCode}`,
            component: 'AUTH',
            event: 'AUTH_DENIED',
            method,
            route,
            statusCode,
            correlationId,
        }, SEVERITY.WARNING);
    } else if (statusCode === 409 && route.startsWith('/api/bookings')) {
        notifyWithoutBlocking('Booking conflict was detected.', {
            alertKey: `BOOKING_CONFLICT:${method}:${route}`,
            component: 'BOOKING',
            event: 'BOOKING_CONFLICT',
            method,
            route,
            statusCode,
            correlationId,
        }, SEVERITY.WARNING);
    } else if (statusCode >= 400 && route.startsWith('/api/admin')) {
        notifyWithoutBlocking('Administrative request failed.', {
            alertKey: `ADMIN_REQUEST_FAILED:${method}:${route}:${statusCode}`,
            component: 'ADMIN',
            event: 'ADMIN_REQUEST_FAILED',
            method,
            route,
            statusCode,
            correlationId,
        }, statusCode >= 500 ? SEVERITY.HIGH : SEVERITY.WARNING);
    }
};

const performanceLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.once('finish', () => {
        const durationMs = Math.round((Number(process.hrtime.bigint() - startedAt) / 1e6) * 100) / 100;
        const method = String(req.method || 'GET').toUpperCase();
        const route = resolveRequestRoute(req);
        const statusCode = Number(res.statusCode) || 0;
        const userAgentFamily = classifyUserAgent(req.get?.('user-agent'));
        const correlationId = req.correlationId || 'unavailable';

        recordRequest({ durationMs, statusCode, route, method, userAgentFamily });
        logger.info('HTTP request completed.', {
            event: 'http_request',
            method,
            route,
            statusCode,
            durationMs,
            userAgentFamily,
            correlationId,
        });
        emitHttpSignals({ method, route, statusCode, durationMs, correlationId });
    });

    next();
};

export default performanceLogger;
