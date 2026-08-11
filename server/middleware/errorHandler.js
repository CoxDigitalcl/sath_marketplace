import logger from '../config/logger.js';
import AlertService, { SEVERITY } from '../services/alertService.js';
import { recordError } from '../services/systemMetricService.js';

const errorHandler = async (err, req, res, next) => {
    logger.error(`${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

    // Alert on 500s (Server Errors)
    if (!err.statusCode || err.statusCode === 500) {
        // Record for Dashboard
        recordError(err, req);

        await AlertService.notify(err, {
            component: 'API',
            path: req.originalUrl,
            method: req.method
        }, SEVERITY.HIGH);
    }

    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorHandler;
