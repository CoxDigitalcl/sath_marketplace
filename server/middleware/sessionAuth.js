import logger from '../config/logger.js';
import { pool } from '../config/db.js';
import { hasCurrentTokenVersion, verifyAccessToken } from '../services/sessionSecurity.js';

const readBearerToken = (authorization) => {
    if (typeof authorization !== 'string') return null;
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    return match?.[1] || null;
};

export const authenticateToken = async (req, res, next) => {
    const token = readBearerToken(req.get('authorization'));
    if (!token) {
        return res.status(401).json({ status: 'error', code: 'AUTH_REQUIRED', message: 'Autenticación requerida.' });
    }

    let claims;
    try {
        claims = verifyAccessToken(token);
    } catch {
        return res.status(401).json({ status: 'error', code: 'TOKEN_INVALID', message: 'La sesión es inválida o expiró.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, email, role, token_version, COALESCE(is_blocked, FALSE) AS is_blocked
             FROM users WHERE id = $1`,
            [claims.id]
        );
        const user = result.rows[0];
        if (!user || user.is_blocked || !hasCurrentTokenVersion(claims, user)) {
            return res.status(401).json({ status: 'error', code: 'SESSION_REVOKED', message: 'La sesión fue revocada.' });
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: user.token_version,
            impersonatedBy: claims.impersonatedBy || null
        };
        return next();
    } catch {
        logger.error('Session validation failed.', { correlationId: req.correlationId });
        return res.status(503).json({
            status: 'error',
            code: 'SESSION_VALIDATION_UNAVAILABLE',
            message: 'No fue posible validar la sesión.'
        });
    }
};

export const requireVerified = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ status: 'error', code: 'AUTH_REQUIRED', message: 'Autenticación requerida.' });
    }
    if (req.user.role === 'admin') return next();
    if (req.user.role !== 'provider') {
        return res.status(403).json({
            status: 'error',
            code: 'VERIFIED_PROVIDER_REQUIRED',
            message: 'Esta acción requiere una cuenta de proveedor verificada.'
        });
    }

    try {
        const result = await pool.query(
            'SELECT is_verified FROM provider_profiles WHERE user_id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0 || !result.rows[0].is_verified) {
            return res.status(403).json({
                status: 'error',
                code: 'KYC_REQUIRED',
                message: 'Completa la verificación de proveedor para continuar.'
            });
        }
        return next();
    } catch {
        return res.status(503).json({
            status: 'error',
            code: 'VERIFICATION_UNAVAILABLE',
            message: 'No fue posible validar la verificación.'
        });
    }
};
