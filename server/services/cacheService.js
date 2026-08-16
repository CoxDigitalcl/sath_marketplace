import NodeCache from 'node-cache';
import logger from '../config/logger.js';

// Standard TTL: 10 minutes (600s)
// Check Period: 120s
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 1000 });

export const get = (key) => {
    const value = cache.get(key);
    if (value) {
        // logger.debug(`[CACHE HIT] Key: ${key}`);
    } else {
        // logger.debug(`[CACHE MISS] Key: ${key}`);
    }
    return value;
};

export const set = (key, value, ttl = 600) => {
    const success = cache.set(key, value, ttl);
    if (success) {
        // logger.debug(`[CACHE SET] Key: ${key} | TTL: ${ttl}s`);
    }
    return success;
};

export const del = (keys) => {
    cache.del(keys);
    logger.info(`[CACHE CLEAR] Keys: ${keys}`);
};

export const flush = () => {
    cache.flushAll();
    logger.info('[CACHE FLUSH] All cache cleared');
};

export const stats = () => {
    const current = cache.getStats();
    const attempts = current.hits + current.misses;
    return {
        keys: current.keys,
        hits: current.hits,
        misses: current.misses,
        hitRate: attempts > 0 ? Math.round((current.hits / attempts) * 10000) / 100 : 0,
        keyBytes: current.ksize,
        valueBytes: current.vsize,
    };
};

export default { get, set, del, flush, stats };
