const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const OPAQUE_SEGMENT = /^[A-Za-z0-9_-]{24,}$/;

const PUBLIC_SLUG_ROUTES = [
    /^\/service\/[^/]+$/,
    /^\/provider\/[^/]+$/,
    /^\/categories\/[^/]+$/,
];

const cleanPath = (value) => {
    const candidate = typeof value === 'string' ? value.split('?')[0].split('#')[0] : '/';
    const withLeadingSlash = candidate.startsWith('/') ? candidate : `/${candidate}`;
    return withLeadingSlash.replace(/\/{2,}/g, '/').slice(0, 240) || '/';
};

export const normalizeRoutePath = (value) => {
    const pathname = cleanPath(value);
    const bookingIdPattern = /^\/api\/bookings\/(?!webhook(?:\/|$)|availability(?:\/|$)|verify(?:\/|$)|guest(?:\/|$)|public(?:\/|$)|provider(?:\/|$))[^/]+(?=\/|$)/;
    if (bookingIdPattern.test(pathname)) {
        return pathname.replace(bookingIdPattern, '/api/bookings/:id');
    }

    if (PUBLIC_SLUG_ROUTES.some((pattern) => pattern.test(pathname))) {
        return `${pathname.slice(0, pathname.lastIndexOf('/'))}/:slug`;
    }

    return pathname
        .split('/')
        .map((segment) => (
            UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment) || OPAQUE_SEGMENT.test(segment)
                ? ':id'
                : segment
        ))
        .join('/');
};

export const resolveRequestRoute = (req = {}) => {
    const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
    if (routePath) {
        const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
        const template = routePath === '/' ? (baseUrl || '/') : `${baseUrl}${routePath}`;
        return normalizeRoutePath(template);
    }

    return normalizeRoutePath(req.path || req.originalUrl || '/');
};

export const classifyUserAgent = (value) => {
    const userAgent = typeof value === 'string' ? value.toLowerCase() : '';

    if (/chatgpt-user/.test(userAgent)) return 'openai-agent';
    if (/gptbot|oai-searchbot/.test(userAgent)) return 'openai-crawler';
    if (/claudebot|claude-web/.test(userAgent)) return 'anthropic-crawler';
    if (/perplexitybot|perplexity-user/.test(userAgent)) return 'perplexity-crawler';
    if (/googlebot/.test(userAgent)) return 'googlebot';
    if (/bingbot/.test(userAgent)) return 'bingbot';
    if (/applebot/.test(userAgent)) return 'applebot';
    if (/bot|crawler|spider|slurp/.test(userAgent)) return 'other-crawler';
    if (/edg\//.test(userAgent)) return 'browser-edge';
    if (/chrome\//.test(userAgent)) return 'browser-chromium';
    if (/firefox\//.test(userAgent)) return 'browser-firefox';
    if (/safari\//.test(userAgent) && /version\//.test(userAgent)) return 'browser-safari';
    return 'other';
};

export default {
    classifyUserAgent,
    normalizeRoutePath,
    resolveRequestRoute,
};
