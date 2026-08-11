import cacheService from '../services/cacheService.js';
import logger from '../config/logger.js';

/**
 * Cache Middleware
 * @param {number} duration - TTL in seconds (default 300)
 */
export const checkCache = (duration = 300) => (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
        return next();
    }

    // Generate Cache Key based on URL string (including query params)
    const key = `__express__${req.originalUrl || req.url}`;

    // 1. Try to get data from cache
    const cachedResponse = cacheService.get(key);

    if (cachedResponse) {
        // HIT: Return cached data
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedResponse);
    }

    // MISS: Proceed but intercept the response to cache it
    res.setHeader('X-Cache', 'MISS');

    // Store original send method
    const originalSend = res.json;

    // Override res.json to capture body
    res.json = (body) => {
        // Restore original to avoid infinite loop
        res.json = originalSend;

        // Cache the body if status is 200
        if (res.statusCode === 200) {
            cacheService.set(key, body, duration);
        }

        // Send the response
        return res.json(body);
    };

    next();
};

export default checkCache;
