import logger from '../config/logger.js';
import AlertService, { SEVERITY } from '../services/alertService.js';
import { recordError } from '../services/systemMetricService.js';
import { resolveRequestRoute } from '../services/requestObservability.js';

const errorHandler = async (err, req, res, next) => {
    const statusCode = Number(err.statusCode || err.status) || 500;
    const isServerError = statusCode >= 500;
    const correlationId = req.correlationId || 'unavailable';
    const safePath = resolveRequestRoute(req);

    logger.error('API request failed.', {
        statusCode,
        method: req.method,
        path: safePath,
        correlationId,
        errorType: err.name || 'Error'
    });

    // Alert on 500s (Server Errors)
    if (isServerError) {
        // Record for Dashboard
        recordError(err, req);

        await AlertService.notify(new Error('Unhandled API error.'), {
            component: 'API',
            path: safePath,
            method: req.method,
            correlationId
        }, SEVERITY.HIGH);
    }

    const productionMessage = isServerError
        ? 'Ocurrió un error interno. Usa el identificador de solicitud si necesitas soporte.'
        : err.message;

    res.status(statusCode).json({
        status: 'error',
        code: isServerError ? 'INTERNAL_SERVER_ERROR' : (err.code || 'REQUEST_ERROR'),
        message: process.env.NODE_ENV === 'production' ? productionMessage : err.message,
        correlationId
    });
};

export default errorHandler;
