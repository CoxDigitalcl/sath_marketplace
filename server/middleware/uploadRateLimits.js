import rateLimit from 'express-rate-limit';

const authenticatedUploadKey = (req) => `user:${req.user?.id || 'missing'}`;

const createUploadLimiter = ({ windowMs, limit, message }) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: authenticatedUploadKey,
    handler: (req, res) => res.status(429).json({
        status: 'error',
        message,
        code: 'UPLOAD_RATE_LIMITED'
    })
});

// Shared by cover and gallery uploads so switching endpoints cannot bypass the quota.
export const serviceMediaUploadLimiter = createUploadLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: 'Demasiadas cargas de archivos. Intenta nuevamente en unos minutos.'
});

export const serviceVideoUploadLimiter = createUploadLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 6,
    message: 'Limite de cargas de video alcanzado. Intenta nuevamente mas tarde.'
});

export const providerProfileUploadLimiter = createUploadLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Demasiadas actualizaciones con archivos. Intenta nuevamente en unos minutos.'
});
