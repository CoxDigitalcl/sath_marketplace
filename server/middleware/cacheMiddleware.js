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

    const rawUrl = req.originalUrl || req.url || '';
    if (rawUrl.length > 2048) {
        return next();
    }

    const query = new URLSearchParams();
    Object.entries(req.query || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .forEach(([name, value]) => {
            const values = Array.isArray(value) ? value : [value];
            values.map(item => String(item)).sort().forEach(item => query.append(name, item));
        });
    const queryString = query.toString();
    const key = `__express__${req.baseUrl || ''}${req.path || ''}${queryString ? `?${queryString}` : ''}`;

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
