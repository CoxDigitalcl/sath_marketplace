import crypto from 'node:crypto';

const VERSION = 'v1';
const PURPOSE = 'checkout-read';
const DEFAULT_TTL_SECONDS = 48 * 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getSecrets = () => {
    const configured = [
        process.env.BOOKING_CAPABILITY_SECRET,
        ...(process.env.BOOKING_CAPABILITY_SECRETS || '').split(','),
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (configured.length === 0) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('BOOKING_CAPABILITY_SECRET is required in production.');
        }
        return ['development-only-booking-capability-secret'];
    }

    if (process.env.NODE_ENV === 'production' && configured[0].length < 32) {
        throw new Error('BOOKING_CAPABILITY_SECRET must contain at least 32 characters.');
    }

    return configured;
};

const signingInput = ({ bookingId, expiresAt }) =>
    [VERSION, PURPOSE, bookingId.toLowerCase(), String(expiresAt)].join('.');

const signatureFor = (secret, input) =>
    crypto.createHmac('sha256', secret).update(input).digest('base64url');

export const createBookingCapability = ({
    bookingId,
    now = Date.now(),
    ttlSeconds = DEFAULT_TTL_SECONDS,
} = {}) => {
    if (!UUID_PATTERN.test(String(bookingId || ''))) {
        throw new TypeError('A valid booking UUID is required.');
    }

    const expiresAt = Math.floor(now / 1000) + ttlSeconds;
    const input = signingInput({ bookingId, expiresAt });
    const signature = signatureFor(getSecrets()[0], input);
    return [VERSION, expiresAt.toString(36), signature].join('.');
};

export const verifyBookingCapability = ({
    bookingId,
    token,
    now = Date.now(),
} = {}) => {
    if (!UUID_PATTERN.test(String(bookingId || '')) || typeof token !== 'string') {
        return { ok: false, code: 'INVALID_BOOKING_CAPABILITY' };
    }

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== VERSION) {
        return { ok: false, code: 'INVALID_BOOKING_CAPABILITY' };
    }

    const expiresAt = Number.parseInt(parts[1], 36);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
        return { ok: false, code: 'EXPIRED_BOOKING_CAPABILITY' };
    }

    const input = signingInput({ bookingId, expiresAt });
    const supplied = Buffer.from(parts[2]);
    const valid = getSecrets().some((secret) => {
        const expected = Buffer.from(signatureFor(secret, input));
        return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    });

    return valid
        ? { ok: true, expiresAt }
        : { ok: false, code: 'INVALID_BOOKING_CAPABILITY' };
};

export const requireBookingCapability = (req, res, next) => {
    try {
        const verification = verifyBookingCapability({
            bookingId: req.params.id,
            token: req.get('x-booking-capability'),
        });

        res.set('Cache-Control', 'no-store');
        res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');

        if (!verification.ok) {
            return res.status(401).json({
                status: 'error',
                code: verification.code,
                message: 'El enlace de reserva es inválido o expiró.',
            });
        }

        req.bookingCapability = verification;
        return next();
    } catch (error) {
        return next(error);
    }
};

export default {
    createBookingCapability,
    verifyBookingCapability,
    requireBookingCapability,
};
