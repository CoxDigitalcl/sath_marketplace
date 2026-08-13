import crypto from 'node:crypto';

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/;

export const createRequestContextMiddleware = ({ randomUUID = crypto.randomUUID } = {}) => (
    (req, res, next) => {
        const candidate = req.get?.('x-request-id');
        const correlationId = typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate)
            ? candidate
            : randomUUID();

        req.correlationId = correlationId;
        res.set('X-Request-ID', correlationId);
        next();
    }
);

export default createRequestContextMiddleware;
