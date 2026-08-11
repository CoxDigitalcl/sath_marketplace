import logger from '../config/logger.js';
import AlertService, { SEVERITY } from '../services/alertService.js';
import { recordLatency } from '../services/systemMetricService.js';

/**
 * Performance Logger Middleware
 * Measures request latency and alerts on slow requests.
 */
const performanceLogger = (req, res, next) => {
    const start = process.hrtime();

    res.on('finish', async () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2); // Convert to ms with 2 decimals
        const duration = parseFloat(timeInMs);

        // 0. Record for System Dashboard (Ephemeral)
        recordLatency(duration);



        // 2. Logging & Alerting
        // Threshold: 2000ms (Critical Performance Issue)
        if (duration > 2000) {
            const warningMsg = `[PERFORMANCE WARNING] Slow Request: ${req.method} ${req.originalUrl} took ${timeInMs}ms`;

            // Log locally
            logger.warn(warningMsg);

            // Send Active Alert (Asynchronous, don't await/block response end)
            AlertService.notify(new Error(warningMsg), {
                component: 'API_PERFORMANCE',
                duration: `${timeInMs}ms`,
                path: req.originalUrl,
                method: req.method,
                ip: req.ip
            }, SEVERITY.WARNING).catch(err => console.error('Failed to send perf alert', err));
        }
        // Threshold: 500ms (Warning)
        else if (duration > 500) {
            logger.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} took ${timeInMs}ms`);
        }
    });

    next();
};

export default performanceLogger;
