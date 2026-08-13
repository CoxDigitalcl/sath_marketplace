import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { sendEmail } from '../services/notificationService.js';
import { createAdminStepUpToken, hashSecurityToken } from '../services/sessionSecurity.js';
import { recordAdminSecurityEvent } from '../services/securityAuditService.js';

const SALT_ROUNDS = 10;
const RESET_CODE_EXPIRY_MINUTES = 15;
const RESET_SESSION_EXPIRY_MINUTES = 10;
const GENERIC_RESET_MESSAGE = 'Si el correo está registrado en nuestra plataforma, recibirás un código de verificación en los próximos minutos.';
const INVALID_RESET_MESSAGE = 'El código o la sesión de recuperación no es válido, ya fue utilizado o expiró.';

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildResetEmail = (code, email) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
        <h1 style="font-size:22px">Recuperación de contraseña</h1>
        <p>Se solicitó recuperar la cuenta ${escapeHtml(email)}.</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>Este código vence en ${RESET_CODE_EXPIRY_MINUTES} minutos y solo puede usarse una vez.</p>
        <p>Si no solicitaste el cambio, ignora este mensaje.</p>
    </div>`;

const withTransaction = async (operation) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await operation(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const requestPasswordReset = async (req, res, next) => {
    try {
        const email = req.body.email.toLowerCase();
        const code = crypto.randomInt(100000, 1000000).toString();
        const hashedCode = await bcrypt.hash(code, SALT_ROUNDS);
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            logger.info('[Password Reset] Request accepted for an unknown account.');
            return res.json({ status: 'success', message: GENERIC_RESET_MESSAGE });
        }

        const user = result.rows[0];
        await withTransaction(async (client) => {
            await client.query(
                'DELETE FROM password_reset_sessions WHERE user_id = $1 AND consumed_at IS NULL',
                [user.id]
            );
            await client.query(
                `UPDATE users
                 SET reset_token = $1,
                     reset_token_expires = NOW() + ($2 * INTERVAL '1 minute'),
                     updated_at = NOW()
                 WHERE id = $3`,
                [hashedCode, RESET_CODE_EXPIRY_MINUTES, user.id]
            );
        });

        const emailSent = await sendEmail({
            to: user.email,
            subject: 'Código de recuperación de contraseña | Serviciosatuhogar',
            html: buildResetEmail(code, user.email)
        });
        logger.info('[Password Reset] Challenge issued.', { userId: user.id, emailSent: Boolean(emailSent) });
        return res.json({ status: 'success', message: GENERIC_RESET_MESSAGE });
    } catch (error) {
        return next(error);
    }
};

export const verifyResetCode = async (req, res, next) => {
    try {
        const { code } = req.body;
        const email = req.body.email.toLowerCase();
        const result = await pool.query(
            'SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1',
            [email]
        );
        const user = result.rows[0];

        if (!user?.reset_token || !user.reset_token_expires || new Date(user.reset_token_expires) <= new Date()) {
            return res.status(400).json({ status: 'error', code: 'RESET_INVALID', message: INVALID_RESET_MESSAGE });
        }

        const matches = await bcrypt.compare(code, user.reset_token);
        if (!matches) {
            return res.status(400).json({ status: 'error', code: 'RESET_INVALID', message: INVALID_RESET_MESSAGE });
        }

        const resetToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = hashSecurityToken(resetToken);
        const issued = await withTransaction(async (client) => {
            const consumedCode = await client.query(
                `UPDATE users
                 SET reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
                 WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()
                 RETURNING id`,
                [user.id, user.reset_token]
            );
            if (consumedCode.rows.length === 0) return false;

            await client.query(
                `INSERT INTO password_reset_sessions (user_id, token_hash, expires_at)
                 VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))`,
                [user.id, tokenHash, RESET_SESSION_EXPIRY_MINUTES]
            );
            return true;
        });

        if (!issued) {
            return res.status(400).json({ status: 'error', code: 'RESET_INVALID', message: INVALID_RESET_MESSAGE });
        }

        logger.info('[Password Reset] Verification code consumed.', { userId: user.id });
        return res.json({
            status: 'success',
            message: 'Código verificado. Ya puedes crear una nueva contraseña.',
            resetToken
        });
    } catch (error) {
        return next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const tokenHash = hashSecurityToken(req.body.resetToken);
        const passwordHash = await bcrypt.hash(req.body.newPassword, SALT_ROUNDS);
        const result = await pool.query(
            `WITH consumed AS (
                UPDATE password_reset_sessions
                SET consumed_at = NOW()
                WHERE token_hash = $1
                  AND consumed_at IS NULL
                  AND expires_at > NOW()
                RETURNING user_id
            )
            UPDATE users AS u
            SET password_hash = $2,
                password_reset_required = FALSE,
                reset_token = NULL,
                reset_token_expires = NULL,
                updated_at = NOW()
            FROM consumed
            WHERE u.id = consumed.user_id
            RETURNING u.id`,
            [tokenHash, passwordHash]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ status: 'error', code: 'RESET_INVALID', message: INVALID_RESET_MESSAGE });
        }
        logger.info('[Password Reset] Password changed and sessions revoked.', { userId: result.rows[0].id });
        return res.json({ status: 'success', message: 'Tu contraseña fue actualizada. Inicia sesión nuevamente.' });
    } catch (error) {
        return next(error);
    }
};

export const changePassword = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }

        const currentMatches = await bcrypt.compare(req.body.currentPassword, result.rows[0].password_hash);
        if (!currentMatches) {
            return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS', message: 'La contraseña actual es incorrecta.' });
        }
        if (await bcrypt.compare(req.body.newPassword, result.rows[0].password_hash)) {
            return res.status(400).json({ status: 'error', message: 'La nueva contraseña debe ser diferente a la actual.' });
        }

        const passwordHash = await bcrypt.hash(req.body.newPassword, SALT_ROUNDS);
        await pool.query(
            `UPDATE users
             SET password_hash = $1, password_reset_required = FALSE, updated_at = NOW()
             WHERE id = $2`,
            [passwordHash, req.user.id]
        );
        logger.info('[Password Change] Password changed and sessions revoked.', { userId: req.user.id });
        return res.json({ status: 'success', message: 'Tu contraseña fue actualizada. Inicia sesión nuevamente.' });
    } catch (error) {
        return next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        await pool.query(
            'UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1',
            [req.user.id]
        );
        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
};

export const createAdminStepUp = async (req, res, next) => {
    const audit = async (outcome) => {
        try {
            await recordAdminSecurityEvent({
                actorAdminId: req.user.id,
                targetUserId: req.user.id,
                action: 'ADMIN_STEP_UP',
                outcome,
                correlationId: req.correlationId
            });
        } catch (auditError) {
            logger.error('Admin step-up audit failed.', { correlationId: req.correlationId });
            if (outcome === 'SUCCESS') throw auditError;
        }
    };

    try {
        const result = await pool.query(
            `SELECT id, email, role, password_hash, token_version, COALESCE(is_blocked, FALSE) AS is_blocked
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        const admin = result.rows[0];
        const valid = admin
            && admin.role === 'admin'
            && !admin.is_blocked
            && await bcrypt.compare(req.body.password, admin.password_hash);

        if (!valid) {
            await audit('DENIED');
            return res.status(403).json({
                status: 'error',
                code: 'STEP_UP_DENIED',
                message: 'No fue posible confirmar tu identidad.'
            });
        }

        const stepUpToken = createAdminStepUpToken(admin);
        await audit('SUCCESS');
        return res.json({
            status: 'success',
            data: { stepUpToken, expiresInSeconds: 300 }
        });
    } catch (error) {
        return next(error);
    }
};
