import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { pool } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
    process.exit(1);
}

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Bearer TOKEN
    const token = authHeader && authHeader.split(' ')[1];

    if (!authHeader) {
        return res.status(401).json({ status: 'error', message: 'Access token required (No Header)' });
    }

    if (!token) {
        return res.status(401).json({ status: 'error', message: 'Access token required (Malformed Header)' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            logger.warn(`JWT verification failed: ${err.message}`);
            return res.status(403).json({ status: 'error', message: 'Token inválido o expirado.' });
        }

        try {
            let result;
            try {
                result = await pool.query(
                    'SELECT id, email, role, COALESCE(is_blocked, false) as is_blocked FROM users WHERE id = $1',
                    [user.id]
                );
            } catch (dbErr) {
                if (dbErr.code !== '42703') throw dbErr;
                result = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [user.id]);
            }

            if (result.rows.length === 0) {
                return res.status(403).json({ status: 'error', message: 'Usuario no encontrado.' });
            }

            const dbUser = result.rows[0];
            if (dbUser.is_blocked) {
                return res.status(403).json({ status: 'error', message: 'Cuenta bloqueada. Contacta a soporte.' });
            }

            req.user = {
                ...user,
                id: dbUser.id,
                email: dbUser.email,
                role: dbUser.role
            };
            next();
        } catch (dbErr) {
            logger.error(`Auth user status check failed: ${dbErr.message}`);
            return res.status(500).json({ status: 'error', message: 'No se pudo validar la sesiÃ³n.' });
        }
    });
};

export const requireVerified = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            status: 'error',
            message: 'Autenticacion requerida.',
            code: 'AUTH_REQUIRED'
        });
    }

    if (req.user.role === 'admin') {
        return next();
    }

    // Verification is a provider capability; every other role fails closed.
    if (req.user.role !== 'provider') {
        return res.status(403).json({
            status: 'error',
            message: 'Esta accion requiere una cuenta de proveedor verificada.',
            code: 'VERIFIED_PROVIDER_REQUIRED'
        });
    }

    // You might need to fetch the latest status from DB if it's not in the token
    // But for performance, let's assume specific critical actions verify DB or we trust a frequent token refresh
    // Ideally, we check the DB state here if 'is_verified' is not in the token payload.
    // Given the current authController implementation, 'is_verified' is NOT in the token.
    // So we must query the DB or update the token strategy.

    // STRATEGY: Query DB for critical actions to be safe.
    import('../config/db.js').then(async ({ pool }) => {
        try {
            const result = await pool.query('SELECT is_verified FROM provider_profiles WHERE user_id = $1', [req.user.id]);
            if (result.rows.length === 0 || !result.rows[0].is_verified) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Account not verified. Please complete your KYC verification to access this feature.',
                    code: 'KYC_REQUIRED'
                });
            }
            next();
        } catch (err) {
            return res.status(500).json({ status: 'error', message: 'Verification check failed' });
        }
    });
};
