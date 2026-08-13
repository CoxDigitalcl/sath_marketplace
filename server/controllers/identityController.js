import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import AlertService, { SEVERITY } from '../services/alertService.js';
import { createAccessToken, verifyAccessToken } from '../services/sessionSecurity.js';

const SALT_ROUNDS = 10;

const buildAuthResponse = (user, profile = {}) => {
    const token = createAccessToken(user);
    const claims = verifyAccessToken(token);
    return {
        token,
        expiresInSeconds: claims.exp - claims.iat,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: profile.full_name || user.full_name || user.email,
            profile_image_url: profile.profile_image_url
        }
    };
};

export const register = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { email, password, role, fullName, phone } = req.body;
        const normalizedEmail = email.toLowerCase();
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await client.query('BEGIN');
        const newUser = await client.query(
            `INSERT INTO users (email, password_hash, role, full_name)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, role, full_name, token_version, created_at`,
            [normalizedEmail, passwordHash, role, fullName || null]
        );
        const user = newUser.rows[0];

        if (role === 'provider') {
            await client.query(
                `INSERT INTO provider_profiles
                    (user_id, full_name, rut, phone, is_verified, bio, coverage_area, coverage_communes)
                 VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7::jsonb)`,
                [
                    user.id,
                    fullName || 'Proveedor',
                    `TEMP-${crypto.randomBytes(6).toString('hex')}`,
                    phone || null,
                    'Pendiente de configurar',
                    'Pendiente',
                    JSON.stringify([])
                ]
            );
        }
        await client.query('COMMIT');

        const auth = buildAuthResponse(user);
        return res.status(201).json({
            status: 'success',
            message: 'Usuario registrado correctamente.',
            ...auth
        });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ status: 'error', code: 'ACCOUNT_EXISTS', message: 'La cuenta ya existe.' });
        }
        logger.error('Registration failed.', { correlationId: req.correlationId });
        await AlertService.notify(
            new Error('Registration operation failed.'),
            { component: 'Auth', action: 'Register', correlationId: req.correlationId },
            SEVERITY.HIGH
        );
        return next(error);
    } finally {
        client.release();
    }
};

export const login = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, email, role, full_name, password_hash, token_version,
                    COALESCE(is_blocked, FALSE) AS is_blocked,
                    COALESCE(password_reset_required, FALSE) AS password_reset_required
             FROM users WHERE email = $1`,
            [req.body.email.toLowerCase()]
        );
        const user = result.rows[0];
        const passwordMatches = user
            ? await bcrypt.compare(req.body.password, user.password_hash)
            : false;

        if (!user || !passwordMatches) {
            logger.warn('Login denied.', { correlationId: req.correlationId });
            return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas.' });
        }
        if (user.is_blocked) {
            return res.status(403).json({ status: 'error', code: 'ACCOUNT_BLOCKED', message: 'Cuenta bloqueada. Contacta a soporte.' });
        }
        if (user.password_reset_required) {
            return res.status(403).json({
                status: 'error',
                code: 'PASSWORD_RESET_REQUIRED',
                message: 'Por seguridad, debes recuperar tu contraseña antes de iniciar sesión.'
            });
        }

        let profile = {};
        if (user.role === 'provider') {
            const profileResult = await pool.query(
                'SELECT full_name, profile_image_url FROM provider_profiles WHERE user_id = $1',
                [user.id]
            );
            profile = profileResult.rows[0] || {};
        }

        const auth = buildAuthResponse(user, profile);
        logger.info('Login succeeded.', { userId: user.id, correlationId: req.correlationId });
        return res.json({ status: 'success', message: 'Sesión iniciada.', ...auth });
    } catch (error) {
        return next(error);
    }
};
