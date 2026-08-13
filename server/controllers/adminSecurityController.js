import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { sendEmail } from '../services/notificationService.js';
import { createAccessToken, IMPERSONATION_TOKEN_EXPIRES_IN, verifyAccessToken } from '../services/sessionSecurity.js';
import { recordAdminSecurityEvent } from '../services/securityAuditService.js';

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

const audit = (client, req, {
    targetUserId,
    action,
    outcome = 'SUCCESS',
    metadata = {}
}) => recordAdminSecurityEvent({
    actorAdminId: req.user.id,
    targetUserId,
    action,
    outcome,
    correlationId: req.correlationId,
    metadata
}, client);

export const blockClient = async (req, res, next) => {
    try {
        const result = await withTransaction(async (client) => {
            const current = await client.query(
                'SELECT id, role, COALESCE(is_blocked, FALSE) AS is_blocked FROM users WHERE id = $1 FOR UPDATE',
                [req.params.id]
            );
            const target = current.rows[0];
            if (!target) return null;
            if (target.role === 'admin') {
                const error = new Error('No se puede bloquear una cuenta administrativa.');
                error.statusCode = 403;
                throw error;
            }

            const nextBlocked = !target.is_blocked;
            await client.query(
                'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2',
                [nextBlocked, target.id]
            );
            await audit(client, req, {
                targetUserId: target.id,
                action: nextBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED'
            });
            return nextBlocked;
        });

        if (result === null) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }
        return res.json({
            status: 'success',
            message: result ? 'Cuenta bloqueada y sesiones revocadas.' : 'Cuenta desbloqueada.',
            data: { is_blocked: result }
        });
    } catch (error) {
        return next(error);
    }
};

export const forcePasswordReset = async (req, res, next) => {
    try {
        const target = await withTransaction(async (client) => {
            const result = await client.query(
                'SELECT id, email, role FROM users WHERE id = $1 FOR UPDATE',
                [req.params.id]
            );
            const user = result.rows[0];
            if (!user) return null;
            if (user.role === 'admin') {
                const error = new Error('No se puede forzar el reset de otra cuenta administrativa.');
                error.statusCode = 403;
                throw error;
            }

            await client.query(
                `UPDATE users
                 SET password_reset_required = TRUE,
                     reset_token = NULL,
                     reset_token_expires = NULL,
                     updated_at = NOW()
                 WHERE id = $1`,
                [user.id]
            );
            await client.query(
                'DELETE FROM password_reset_sessions WHERE user_id = $1 AND consumed_at IS NULL',
                [user.id]
            );
            await audit(client, req, {
                targetUserId: user.id,
                action: 'PASSWORD_RESET_FORCED'
            });
            return user;
        });

        if (!target) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }

        const appUrl = process.env.APP_URL || 'https://serviciosatuhogar.cl';
        const notificationSent = await sendEmail({
            to: target.email,
            subject: 'Acción requerida: restablece tu contraseña | Serviciosatuhogar',
            html: `<p>Por seguridad, tus sesiones fueron cerradas.</p>
                   <p>Solicita un código nuevo en <a href="${appUrl}/forgot-password">recuperar contraseña</a>.</p>`
        });
        logger.warn('[ADMIN] Password reset required.', {
            adminId: req.user.id,
            targetUserId: target.id,
            correlationId: req.correlationId,
            notificationSent: Boolean(notificationSent)
        });

        return res.json({
            status: 'success',
            message: 'Las sesiones fueron revocadas y la cuenta requerirá restablecer su contraseña.',
            data: { recoveryRequired: true, notificationSent: Boolean(notificationSent) }
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteClientData = async (req, res, next) => {
    try {
        const deleted = await withTransaction(async (client) => {
            const result = await client.query(
                'SELECT id, role FROM users WHERE id = $1 FOR UPDATE',
                [req.params.id]
            );
            const user = result.rows[0];
            if (!user) return false;
            if (user.role === 'admin') {
                const error = new Error('No se puede anonimizar una cuenta administrativa.');
                error.statusCode = 403;
                throw error;
            }

            const anonymizedEmail = `deleted_${user.id.replaceAll('-', '').slice(0, 16)}@anonimizado.internal`;
            await client.query(
                `UPDATE users
                 SET email = $1,
                     password_hash = 'ACCOUNT_DISABLED',
                     is_blocked = TRUE,
                     password_reset_required = FALSE,
                     reset_token = NULL,
                     reset_token_expires = NULL,
                     updated_at = NOW()
                 WHERE id = $2`,
                [anonymizedEmail, user.id]
            );
            await client.query(
                `UPDATE provider_profiles
                 SET full_name = 'Usuario Eliminado', phone = NULL, bio = NULL
                 WHERE user_id = $1`,
                [user.id]
            );
            await client.query('DELETE FROM password_reset_sessions WHERE user_id = $1', [user.id]);
            await audit(client, req, {
                targetUserId: user.id,
                action: 'USER_DATA_ANONYMIZED'
            });
            return true;
        });

        if (!deleted) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }
        return res.json({
            status: 'success',
            message: 'Los datos personales fueron anonimizados y todas las sesiones quedaron revocadas.'
        });
    } catch (error) {
        return next(error);
    }
};

export const impersonateUser = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, email, role, token_version,
                    COALESCE(is_blocked, FALSE) AS is_blocked,
                    COALESCE(password_reset_required, FALSE) AS password_reset_required
             FROM users WHERE id = $1`,
            [req.params.userId]
        );
        const target = result.rows[0];
        if (!target) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }
        if (target.role === 'admin' || target.is_blocked || target.password_reset_required) {
            return res.status(403).json({
                status: 'error',
                code: 'IMPERSONATION_NOT_ALLOWED',
                message: 'La cuenta seleccionada no admite impersonación.'
            });
        }

        const token = createAccessToken(target, {
            expiresIn: '15m',
            impersonatedBy: req.user.id
        });
        const claims = verifyAccessToken(token);
        await recordAdminSecurityEvent({
            actorAdminId: req.user.id,
            targetUserId: target.id,
            action: 'USER_IMPERSONATED',
            outcome: 'SUCCESS',
            correlationId: req.correlationId,
            metadata: { targetRole: target.role, expiresIn: IMPERSONATION_TOKEN_EXPIRES_IN }
        });

        return res.json({
            status: 'success',
            message: 'Sesión temporal de soporte iniciada.',
            token,
            user: {
                id: target.id,
                email: target.email,
                role: target.role,
                impersonatedBy: req.user.id,
                impersonationExpiresAt: new Date(claims.exp * 1000).toISOString()
            }
        });
    } catch (error) {
        return next(error);
    }
};
