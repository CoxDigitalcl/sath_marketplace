import { getApplicationOrigin } from '../config/application.js';

const getForwardedProtocol = (req) => {
    const value = req.get?.('x-forwarded-proto');
    if (typeof value !== 'string') return '';
    return value.split(',')[0].trim().toLowerCase();
};

const getSafeRequestPath = (req) => {
    const originalUrl = typeof req.originalUrl === 'string' ? req.originalUrl : '/';
    return `/${originalUrl.replace(/^[/\\]+/, '')}`;
};

export const createHttpsRedirectMiddleware = (environment = process.env) => (req, res, next) => {
    if (environment.NODE_ENV !== 'production') return next();

    const isHttps = req.secure === true || getForwardedProtocol(req) === 'https';
    if (isHttps) return next();

    const target = new URL(getSafeRequestPath(req), `${getApplicationOrigin(environment)}/`);
    return res.redirect(308, target.toString());
};

export default createHttpsRedirectMiddleware;
