import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { verifyTransaction } from '../services/payku.js';
import { createPaymentConfirmationEffects } from '../services/paymentConfirmationEffects.js';
import { createPaymentOutboxWorker } from '../services/paymentOutboxWorker.js';
import { createPaykuPaymentProcessor } from '../services/paykuPaymentProcessor.js';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const PAID_STATUSES = new Set(['in_escrow', 'service_completed', 'released', 'disputed']);

const processor = createPaykuPaymentProcessor({ pool, verifyTransaction, logger });
const effectHandlers = createPaymentConfirmationEffects({ pool, log: logger });
const outboxWorker = createPaymentOutboxWorker({ pool, handlers: effectHandlers, logger });

let stopOutboxWorker = null;

const getCorrelationId = (req) => {
    const candidate = req.id || req.get?.('x-request-id');
    return typeof candidate === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(candidate)
        ? candidate
        : undefined;
};

const setPrivateResponseHeaders = (res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
};

export const handlePaykuWebhook = async (req, res) => {
    const correlationId = getCorrelationId(req);
    const result = await processor.processWebhook(req.body, { correlationId });

    if (result.outcome === 'retry') {
        return res.status(503).json({
            status: 'retry',
            code: result.code,
        });
    }

    if (result.outcome === 'rejected') {
        return res.status(200).json({
            status: 'rejected',
            code: result.code,
        });
    }

    if (result.outcome === 'confirmed') {
        void outboxWorker.processBatch().catch((error) => {
            logger.error('[Payment Outbox] Immediate drain failed', {
                errorCode: error?.code || 'PAYMENT_OUTBOX_DRAIN_FAILED',
                correlationId,
            });
        });
    }

    return res.status(200).json({
        status: 'success',
        duplicate: result.outcome === 'duplicate',
        booking_status: result.bookingStatus,
    });
};

// This route is deliberately read-only. Only the authenticated/capability flow
// planned for Stage 2 may actively reconcile a payment outside the webhook.
export const verifyPayment = async (req, res, next) => {
    try {
        setPrivateResponseHeaders(res);
        const { id } = req.params;
        if (!UUID_PATTERN.test(id)) {
            return res.status(400).json({ status: 'error', message: 'Identificador inválido.' });
        }

        const result = await pool.query(
            `SELECT
                b.id,
                b.status,
                b.amount,
                b.scheduled_date,
                b.selected_times,
                b.duration_hours,
                b.created_at,
                s.title AS service_title,
                s.image_urls AS service_images,
                p.full_name AS provider_name,
                CASE WHEN b.status IN ('in_escrow', 'service_completed', 'released', 'disputed')
                     THEN p.contact_email ELSE NULL END AS provider_email,
                CASE WHEN b.status IN ('in_escrow', 'service_completed', 'released', 'disputed')
                     THEN p.public_phone ELSE NULL END AS provider_phone
             FROM bookings b
             JOIN services s ON b.service_id = s.id
             JOIN provider_profiles p ON b.provider_id = p.user_id
             WHERE b.id = $1`,
            [id]
        );

        if (result.rows.length !== 1) {
            return res.status(404).json({ status: 'error', message: 'Reserva no encontrada.' });
        }

        const booking = result.rows[0];
        const paymentConfirmed = PAID_STATUSES.has(booking.status);
        return res.json({
            status: 'success',
            payment_confirmed: paymentConfirmed,
            booking: paymentConfirmed ? booking : { id: booking.id, status: booking.status },
            message: paymentConfirmed ? undefined : 'Pago aún en proceso.',
        });
    } catch (error) {
        return next(error);
    }
};

export const startPaymentOutboxWorker = (options) => {
    if (!stopOutboxWorker) {
        stopOutboxWorker = outboxWorker.start(options);
    }
    return stopOutboxWorker;
};

export default {
    handlePaykuWebhook,
    verifyPayment,
    startPaymentOutboxWorker,
};
