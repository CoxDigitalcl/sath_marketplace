const noopLogger = Object.freeze({
    info() {},
    warn() {},
    error() {},
});

const normalizeErrorCode = (error) => {
    const candidate = typeof error?.code === 'string' ? error.code.trim().toUpperCase() : '';
    return /^[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : 'PAYMENT_EFFECT_FAILED';
};

const parsePayload = (event) => {
    const payload = typeof event.payload === 'string'
        ? JSON.parse(event.payload)
        : event.payload;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        const error = new Error('Invalid payment outbox payload');
        error.code = 'INVALID_OUTBOX_PAYLOAD';
        throw error;
    }
    if (String(payload.bookingId || '') !== String(event.aggregate_id || '')) {
        const error = new Error('Outbox aggregate mismatch');
        error.code = 'OUTBOX_AGGREGATE_MISMATCH';
        throw error;
    }

    return payload;
};

export const createPaymentOutboxWorker = ({ pool, handlers = {}, logger = noopLogger } = {}) => {
    if (!pool?.query) {
        throw new TypeError('A PostgreSQL-compatible pool is required');
    }

    const processBatch = async ({ batchSize = 10 } = {}) => {
        const safeBatchSize = Number.isSafeInteger(batchSize) && batchSize > 0
            ? Math.min(batchSize, 50)
            : 10;

        const claimedResult = await pool.query(
            `WITH claimable AS (
                SELECT id
                FROM payment_outbox
                WHERE processed_at IS NULL
                  AND available_at <= CURRENT_TIMESTAMP
                  AND (
                    locked_at IS NULL OR
                    locked_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
                  )
                ORDER BY available_at ASC, id ASC
                FOR UPDATE SKIP LOCKED
                LIMIT $1
             )
             UPDATE payment_outbox AS outbox
             SET locked_at = CURRENT_TIMESTAMP,
                 attempt_count = outbox.attempt_count + 1
             FROM claimable
             WHERE outbox.id = claimable.id
             RETURNING outbox.id,
                       outbox.event_type,
                       outbox.aggregate_id,
                       outbox.payload,
                       outbox.attempt_count`,
            [safeBatchSize]
        );

        let processed = 0;
        let failed = 0;

        for (const event of claimedResult.rows) {
            try {
                const handler = handlers[event.event_type];
                if (typeof handler !== 'function') {
                    const error = new Error('Unsupported payment outbox event');
                    error.code = 'UNSUPPORTED_OUTBOX_EVENT';
                    throw error;
                }

                const payload = parsePayload(event);
                await handler(payload, event);
                await pool.query(
                    `UPDATE payment_outbox
                     SET processed_at = CURRENT_TIMESTAMP,
                         locked_at = NULL,
                         last_error_code = NULL
                     WHERE id = $1
                       AND processed_at IS NULL`,
                    [event.id]
                );
                processed += 1;
            } catch (error) {
                const errorCode = normalizeErrorCode(error);
                await pool.query(
                    `UPDATE payment_outbox
                     SET locked_at = NULL,
                         available_at = CURRENT_TIMESTAMP +
                             (LEAST(3600, 30 * POWER(2, LEAST(attempt_count, 7))) * INTERVAL '1 second'),
                         last_error_code = $2
                     WHERE id = $1
                       AND processed_at IS NULL`,
                    [event.id, errorCode]
                );
                logger.error('[Payment Outbox] Effect failed', {
                    eventId: event.id,
                    eventType: event.event_type,
                    errorCode,
                });
                failed += 1;
            }
        }

        return {
            claimed: claimedResult.rows.length,
            processed,
            failed,
        };
    };

    const start = ({ intervalMs = 5000, batchSize = 10 } = {}) => {
        const safeInterval = Number.isSafeInteger(intervalMs) && intervalMs >= 1000
            ? intervalMs
            : 5000;
        let running = false;

        const tick = async () => {
            if (running) return;
            running = true;
            try {
                await processBatch({ batchSize });
            } catch (error) {
                logger.error('[Payment Outbox] Batch failed', {
                    errorCode: normalizeErrorCode(error),
                });
            } finally {
                running = false;
            }
        };

        const timer = setInterval(tick, safeInterval);
        timer.unref?.();
        void tick();

        return () => clearInterval(timer);
    };

    return { processBatch, start };
};

export default createPaymentOutboxWorker;
