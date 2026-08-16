import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { createInAppNotification } from './notificationController.js';
import { validateBookingTransition } from '../services/bookingStateMachine.js';

const notifyStatusChange = async ({ booking, targetStatus, actorRole }) => {
    try {
        const serviceResult = await pool.query('SELECT title FROM services WHERE id = $1', [booking.service_id]);
        const serviceName = serviceResult.rows[0]?.title || 'Servicio';
        const labels = {
            service_completed: 'completado',
            released: 'pagado',
            disputed: 'en disputa',
            cancelled: 'cancelado',
        };
        const label = labels[targetStatus];
        if (!label) return;

        if (booking.client_id) {
            void createInAppNotification({
                userId: booking.client_id,
                title: `Reserva ${label}`,
                message: `Tu reserva de "${serviceName}" ha sido marcada como ${label}.`,
                type: ['released', 'service_completed'].includes(targetStatus) ? 'success' : 'warning',
                link: '/client?view=orders',
            });
        }
        if (actorRole !== 'provider') {
            void createInAppNotification({
                userId: booking.provider_id,
                title: `Reserva ${label}`,
                message: `La reserva de "${serviceName}" ha sido marcada como ${label}.`,
                type: ['released', 'service_completed'].includes(targetStatus) ? 'success' : 'warning',
                link: '/provider?view=orders',
            });
        }
    } catch (error) {
        logger.error('[Booking Status] Notification failed', { code: error?.code || 'UNKNOWN' });
    }
};

export const updateBookingStatus = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const bookingId = req.params.id;
        const targetStatus = req.body?.status;
        const actorId = req.user.id;
        const actorRole = req.user.role;

        await client.query('BEGIN');
        const currentResult = await client.query(
            `SELECT id, client_id, provider_id, service_id, status
             FROM bookings
             WHERE id = $1
             FOR UPDATE`,
            [bookingId]
        );
        if (currentResult.rows.length !== 1) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Reserva no encontrada.' });
        }

        const booking = currentResult.rows[0];
        const transition = validateBookingTransition({
            currentStatus: booking.status,
            targetStatus,
            role: actorRole,
            actorId,
            clientId: booking.client_id,
            providerId: booking.provider_id,
        });
        if (!transition.ok) {
            await client.query('ROLLBACK');
            const forbidden = transition.code === 'BOOKING_TRANSITION_FORBIDDEN';
            return res.status(forbidden ? 403 : 409).json({
                status: 'error',
                code: transition.code,
                message: forbidden
                    ? 'Cambio de estado no autorizado para tu rol.'
                    : `No se puede pasar de '${booking.status}' a '${targetStatus}'.`,
            });
        }

        const updateResult = await client.query(
            `UPDATE bookings
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND status = $3
             RETURNING *`,
            [targetStatus, bookingId, booking.status]
        );
        if (updateResult.rows.length !== 1) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                status: 'error',
                code: 'BOOKING_STATE_RACE',
                message: 'La reserva cambió mientras se procesaba la solicitud.',
            });
        }

        if (targetStatus === 'cancelled') {
            await client.query(
                `UPDATE booking_slots
                 SET state = 'cancelled', hold_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE booking_id = $1 AND state IN ('held', 'released', 'confirmed')`,
                [bookingId]
            );
        }

        await client.query('COMMIT');
        logger.info('[Booking Status] Transition committed', {
            bookingId,
            from: booking.status,
            to: targetStatus,
            actorRole,
        });

        void notifyStatusChange({ booking, targetStatus, actorRole });
        return res.json({
            status: 'success',
            message: 'Estado de reserva actualizado.',
            booking: updateResult.rows[0],
        });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* Best-effort rollback. */ }
        return next(error);
    } finally {
        client.release();
    }
};

export default { updateBookingStatus };
