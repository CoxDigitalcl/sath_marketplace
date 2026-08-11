import {
    validatePaykuPaymentVerification,
    validatePaykuWebhookPayload,
} from './paykuPaymentIntegrity.js';

const PROVIDER = 'payku';

const noopLogger = Object.freeze({
    info() {},
    warn() {},
    error() {},
});

const normalizeDbIdentifier = (value) => value === null || value === undefined
    ? null
    : String(value);

const exactEventMatch = (event, verified) => Boolean(event) &&
    normalizeDbIdentifier(event.booking_id) === verified.bookingId &&
    normalizeDbIdentifier(event.payment_key) === verified.paymentKey &&
    normalizeDbIdentifier(event.gateway_transaction_id) === verified.gatewayTransactionId;

const rollbackQuietly = async (client) => {
    try {
        await client.query('ROLLBACK');
    } catch {
        // The original database failure is the actionable error.
    }
};

export const createPaykuPaymentProcessor = ({ pool, verifyTransaction, logger = noopLogger } = {}) => {
    if (!pool?.query || !pool?.connect) {
        throw new TypeError('A PostgreSQL-compatible pool is required');
    }
    if (typeof verifyTransaction !== 'function') {
        throw new TypeError('verifyTransaction is required');
    }

    const processWebhook = async (payload, { correlationId } = {}) => {
        const parsedCallback = validatePaykuWebhookPayload(payload);
        if (!parsedCallback.ok) {
            logger.warn('[Payku Webhook] Rejected malformed callback', {
                code: parsedCallback.code,
                correlationId,
            });
            return { outcome: 'rejected', code: parsedCallback.code };
        }

        const callback = parsedCallback.value;
        let booking;

        try {
            const bookingResult = await pool.query(
                `SELECT id, status, amount, transaction_id
                 FROM bookings
                 WHERE transaction_id = $1
                 LIMIT 2`,
                [callback.paymentKey]
            );

            if (bookingResult.rows.length === 0) {
                return { outcome: 'rejected', code: 'PAYMENT_KEY_NOT_FOUND' };
            }
            if (bookingResult.rows.length !== 1) {
                return { outcome: 'rejected', code: 'AMBIGUOUS_PAYMENT_KEY' };
            }

            booking = bookingResult.rows[0];
        } catch (error) {
            logger.error('[Payku Webhook] Booking lookup failed', {
                code: error?.code || 'DATABASE_ERROR',
                correlationId,
            });
            return { outcome: 'retry', code: 'DATABASE_ERROR' };
        }

        if (normalizeDbIdentifier(booking.id) !== callback.order) {
            return { outcome: 'rejected', code: 'ORDER_MISMATCH' };
        }
        if (normalizeDbIdentifier(booking.transaction_id) !== callback.paymentKey) {
            return { outcome: 'rejected', code: 'PAYMENT_KEY_MISMATCH' };
        }

        let verification;
        try {
            // This network call deliberately happens before BEGIN/FOR UPDATE.
            verification = await verifyTransaction(callback.paymentKey);
        } catch (error) {
            logger.error('[Payku Webhook] Server-to-server verification unavailable', {
                code: error?.code || 'PAYKU_UNAVAILABLE',
                correlationId,
            });
            return { outcome: 'retry', code: 'PAYKU_VERIFICATION_UNAVAILABLE' };
        }

        const verified = validatePaykuPaymentVerification({ booking, callback, verification });
        if (!verified.ok) {
            logger.warn('[Payku Webhook] Verification facts did not match', {
                code: verified.code,
                bookingId: normalizeDbIdentifier(booking.id),
                correlationId,
            });
            return { outcome: 'rejected', code: verified.code };
        }

        const client = await pool.connect();
        let transactionStarted = false;

        try {
            await client.query('BEGIN');
            transactionStarted = true;

            const lockedResult = await client.query(
                `SELECT id, status, amount, transaction_id
                 FROM bookings
                 WHERE transaction_id = $1
                 FOR UPDATE`,
                [verified.value.paymentKey]
            );

            if (lockedResult.rows.length !== 1) {
                await rollbackQuietly(client);
                transactionStarted = false;
                return {
                    outcome: 'rejected',
                    code: lockedResult.rows.length === 0 ? 'PAYMENT_KEY_NOT_FOUND' : 'AMBIGUOUS_PAYMENT_KEY',
                };
            }

            const lockedBooking = lockedResult.rows[0];
            const lockedVerification = validatePaykuPaymentVerification({
                booking: lockedBooking,
                callback,
                verification,
            });
            if (!lockedVerification.ok) {
                await rollbackQuietly(client);
                transactionStarted = false;
                return { outcome: 'rejected', code: lockedVerification.code };
            }

            const existingResult = await client.query(
                `SELECT booking_id, payment_key, gateway_transaction_id
                 FROM payment_webhook_events
                 WHERE provider = $1
                   AND (payment_key = $2 OR gateway_transaction_id = $3)
                 LIMIT 2`,
                [PROVIDER, verified.value.paymentKey, verified.value.gatewayTransactionId]
            );

            if (existingResult.rows.length > 0) {
                const isExactReplay = existingResult.rows.length === 1 &&
                    exactEventMatch(existingResult.rows[0], verified.value);

                if (!isExactReplay) {
                    await rollbackQuietly(client);
                    transactionStarted = false;
                    return { outcome: 'rejected', code: 'PAYMENT_EVENT_CONFLICT' };
                }

                await client.query('COMMIT');
                transactionStarted = false;
                return {
                    outcome: 'duplicate',
                    bookingId: verified.value.bookingId,
                    bookingStatus: lockedBooking.status,
                };
            }

            if (lockedBooking.status !== 'pending_payment') {
                await rollbackQuietly(client);
                transactionStarted = false;
                return { outcome: 'rejected', code: 'BOOKING_STATE_CONFLICT' };
            }

            await client.query(
                `INSERT INTO payment_webhook_events (
                    provider,
                    payment_key,
                    gateway_transaction_id,
                    booking_id,
                    status,
                    amount,
                    currency
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    PROVIDER,
                    verified.value.paymentKey,
                    verified.value.gatewayTransactionId,
                    verified.value.bookingId,
                    verified.value.status,
                    verified.value.amount,
                    verified.value.currency,
                ]
            );

            const updateResult = await client.query(
                `UPDATE bookings
                 SET status = 'in_escrow',
                     paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                   AND transaction_id = $2
                   AND status = 'pending_payment'
                 RETURNING id, status`,
                [verified.value.bookingId, verified.value.paymentKey]
            );

            if (updateResult.rows.length !== 1) {
                await rollbackQuietly(client);
                transactionStarted = false;
                return { outcome: 'retry', code: 'PAYMENT_STATE_RACE' };
            }

            const minimalPayload = JSON.stringify({ bookingId: verified.value.bookingId });
            await client.query(
                `INSERT INTO payment_outbox (
                    event_type,
                    aggregate_id,
                    deduplication_key,
                    payload
                 ) VALUES
                    ('payment.notifications.requested', $1, $2, $3::jsonb),
                    ('payment.invoice.requested', $1, $4, $5::jsonb)
                 ON CONFLICT (deduplication_key) DO NOTHING`,
                [
                    verified.value.bookingId,
                    `${PROVIDER}:${verified.value.paymentKey}:notifications`,
                    minimalPayload,
                    `${PROVIDER}:${verified.value.paymentKey}:invoice`,
                    minimalPayload,
                ]
            );

            await client.query('COMMIT');
            transactionStarted = false;

            logger.info('[Payku Webhook] Payment confirmed', {
                bookingId: verified.value.bookingId,
                correlationId,
            });
            return {
                outcome: 'confirmed',
                bookingId: verified.value.bookingId,
                bookingStatus: updateResult.rows[0].status,
            };
        } catch (error) {
            if (transactionStarted) {
                await rollbackQuietly(client);
            }

            const conflict = error?.code === '23505';
            logger.error('[Payku Webhook] Atomic processing failed', {
                code: conflict ? 'PAYMENT_EVENT_CONFLICT' : (error?.code || 'DATABASE_ERROR'),
                bookingId: verified.value.bookingId,
                correlationId,
            });
            return {
                outcome: conflict ? 'rejected' : 'retry',
                code: conflict ? 'PAYMENT_EVENT_CONFLICT' : 'DATABASE_ERROR',
            };
        } finally {
            client.release();
        }
    };

    return { processWebhook };
};

export default createPaykuPaymentProcessor;
