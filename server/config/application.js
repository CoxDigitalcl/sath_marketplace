const DEFAULT_APPLICATION_ORIGIN = 'https://serviciosatuhogar.cl';

const normalizeOrigin = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const parsed = new URL(value.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        if (parsed.username || parsed.password) return null;
        return parsed.origin;
    } catch {
        return null;
    }
};

export const getApplicationOrigin = (environment = process.env) => {
    const configured = normalizeOrigin(environment.APP_URL || environment.FRONTEND_URL);
    if (!configured) return DEFAULT_APPLICATION_ORIGIN;

    if (environment.NODE_ENV === 'production' && !configured.startsWith('https://')) {
        return DEFAULT_APPLICATION_ORIGIN;
    }

    return configured;
};

export const getCorsOrigins = (environment = process.env) => {
    const configured = String(environment.CORS_ORIGIN || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean);

    const productionSafe = environment.NODE_ENV === 'production'
        ? configured.filter(origin => origin.startsWith('https://'))
        : configured;

    const origins = productionSafe.length > 0
        ? productionSafe
        : [getApplicationOrigin(environment)];

    return [...new Set(origins)];
};

export { DEFAULT_APPLICATION_ORIGIN, normalizeOrigin };
