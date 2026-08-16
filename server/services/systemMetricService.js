import { normalizeRoutePath } from './requestObservability.js';

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const percentile = (values, quantile) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
    return round(sorted[index]);
};

const summarizeLatencies = (values) => ({
    average: values.length > 0 ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
});

export const createMetricStore = ({ maxRequests = 1000, maxErrors = 20, now = () => new Date() } = {}) => {
    const requestHistory = [];
    const errorHistory = [];

    const recordRequest = ({
        durationMs,
        statusCode = 200,
        route = '/',
        method = 'GET',
        userAgentFamily = 'other',
    } = {}) => {
        const duration = Math.max(0, Number(durationMs) || 0);
        const status = Number.isInteger(Number(statusCode)) ? Number(statusCode) : 0;
        requestHistory.push({
            durationMs: round(duration),
            statusCode: status,
            route: normalizeRoutePath(route),
            method: String(method || 'GET').toUpperCase().slice(0, 12),
            userAgentFamily: String(userAgentFamily || 'other').slice(0, 40),
        });

        while (requestHistory.length > maxRequests) requestHistory.shift();
    };

    const recordLatency = (durationMs) => recordRequest({ durationMs });

    const recordError = (_error, req = {}) => {
        errorHistory.unshift({
            timestamp: now().toISOString(),
            message: 'Internal server error',
            path: normalizeRoutePath(req.path || req.originalUrl || '/'),
            method: String(req.method || 'UNKNOWN').toUpperCase().slice(0, 12),
            correlationId: String(req.correlationId || 'unavailable').slice(0, 64),
        });
        if (errorHistory.length > maxErrors) errorHistory.length = maxErrors;
    };

    const getStats = () => {
        const latencies = requestHistory.map((entry) => entry.durationMs);
        const latencyMs = summarizeLatencies(latencies);
        const total = requestHistory.length;
        const clientErrors = requestHistory.filter(({ statusCode }) => statusCode >= 400 && statusCode < 500).length;
        const serverErrors = requestHistory.filter(({ statusCode }) => statusCode >= 500).length;
        const rateLimited = requestHistory.filter(({ statusCode }) => statusCode === 429).length;
        const routes = {};
        const userAgentFamilies = {};

        for (const entry of requestHistory) {
            const key = `${entry.method} ${entry.route}`;
            const routeEntry = routes[key] || { count: 0, durations: [], clientErrors: 0, serverErrors: 0, rateLimited: 0 };
            routeEntry.count += 1;
            routeEntry.durations.push(entry.durationMs);
            if (entry.statusCode >= 400 && entry.statusCode < 500) routeEntry.clientErrors += 1;
            if (entry.statusCode >= 500) routeEntry.serverErrors += 1;
            if (entry.statusCode === 429) routeEntry.rateLimited += 1;
            routes[key] = routeEntry;
            userAgentFamilies[entry.userAgentFamily] = (userAgentFamilies[entry.userAgentFamily] || 0) + 1;
        }

        for (const [key, value] of Object.entries(routes)) {
            routes[key] = {
                count: value.count,
                p50: percentile(value.durations, 0.5),
                p95: percentile(value.durations, 0.95),
                p99: percentile(value.durations, 0.99),
                clientErrors: value.clientErrors,
                serverErrors: value.serverErrors,
                rateLimited: value.rateLimited,
            };
        }

        const percentage = (count) => total > 0 ? round((count / total) * 100) : 0;
        return {
            uptime: process.uptime(),
            avgLatency: latencyMs.average,
            totalRequestsMonitored: total,
            recentErrors: [...errorHistory],
            memoryUsage: round(process.memoryUsage().rss / 1024 / 1024),
            latencyMs,
            httpStatus: {
                total,
                successful: requestHistory.filter(({ statusCode }) => statusCode >= 200 && statusCode < 400).length,
                clientErrors,
                serverErrors,
                rateLimited,
                clientErrorRate: percentage(clientErrors),
                serverErrorRate: percentage(serverErrors),
                rateLimitedRate: percentage(rateLimited),
            },
            routes,
            userAgentFamilies,
        };
    };

    const reset = () => {
        requestHistory.length = 0;
        errorHistory.length = 0;
    };

    return { getStats, recordError, recordLatency, recordRequest, reset };
};

const metricStore = createMetricStore();

export const getStats = metricStore.getStats;
export const recordError = metricStore.recordError;
export const recordLatency = metricStore.recordLatency;
export const recordRequest = metricStore.recordRequest;

export default metricStore;
