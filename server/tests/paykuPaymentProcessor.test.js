import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaykuPaymentProcessor } from '../services/paykuPaymentProcessor.js';

const BOOKING_ID = 'fa6e9af9-f935-4b2e-8fb7-1af35503bd8f';
const PAYMENT_KEY = 'trx3b4d77b43acd9a720';
const GATEWAY_TRANSACTION_ID = '107999';

const callbackPayload = (overrides = {}) => ({
    transaction_id: GATEWAY_TRANSACTION_ID,
    payment_key: PAYMENT_KEY,
    transaction_key: 'dv032360ead078acd4b',
    verification_key: '6669cbd982ef54c28f2f15fb9dc5262d',
    order: BOOKING_ID,
    status: 'success',
    ...overrides,
});

const bookingRow = (overrides = {}) => ({
    id: BOOKING_ID,
    status: 'pending_payment',
    amount: 25000,
    transaction_id: PAYMENT_KEY,
    ...overrides,
});

const verificationPayload = (overrides = {}) => ({
    status: 'success',
    id: PAYMENT_KEY,
    order: BOOKING_ID,
    amount: '25000',
    payment: {
        transaction_id: GATEWAY_TRANSACTION_ID,
        transaction_key: 'dv032360ead078acd4b',
        verification_key: '6669cbd982ef54c28f2f15fb9dc5262d',
        currency: 'CLP',
    },
    gateway_response: { status: 'success' },
    ...overrides,
});

const createHarness = ({ booking = bookingRow(), lockedBooking = booking, existingEvent = null, updateRows } = {}) => {
    const calls = [];
    const client = {
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            calls.push({ target: 'client', sql: normalized, params });

            if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
                return { rows: [], rowCount: 0 };
            }
            if (normalized.includes('FROM bookings') && normalized.includes('FOR UPDATE')) {
                return { rows: lockedBooking ? [lockedBooking] : [], rowCount: lockedBooking ? 1 : 0 };
            }
            if (normalized.includes('FROM payment_webhook_events')) {
                return { rows: existingEvent ? [existingEvent] : [], rowCount: existingEvent ? 1 : 0 };
            }
            if (normalized.startsWith('INSERT INTO payment_webhook_events')) {
                return { rows: [{ id: 41 }], rowCount: 1 };
            }
            if (normalized.startsWith('UPDATE bookings')) {
                const rows = updateRows ?? [{ ...lockedBooking, status: 'in_escrow' }];
                return { rows, rowCount: rows.length };
            }
            if (normalized.startsWith('INSERT INTO payment_outbox')) {
                return { rows: [], rowCount: 2 };
            }

            throw new Error(`Unexpected client query: ${normalized}`);
        },
        release() {
            calls.push({ target: 'client', sql: 'RELEASE', params: [] });
        },
    };

    const pool = {
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            calls.push({ target: 'pool', sql: normalized, params });
            if (normalized.includes('FROM bookings') && normalized.includes('transaction_id = $1')) {
                return { rows: [booking], rowCount: 1 };
            }
            throw new Error(`Unexpected pool query: ${normalized}`);
        },
        async connect() {
            calls.push({ target: 'pool', sql: 'CONNECT', params: [] });
            return client;
        },
    };

    const verifyTransaction = async (paymentKey, mode) => {
        calls.push({ target: 'payku', sql: 'VERIFY', params: [paymentKey, mode] });
        return verificationPayload();
    };

    return { calls, pool, verifyTransaction };
};

test('verifies remotely before opening the short database transaction and persists event, transition and outbox atomically', async () => {
    const harness = createHarness();
    const processor = createPaykuPaymentProcessor(harness);

    const result = await processor.processWebhook(callbackPayload());

    assert.deepEqual(result, {
        outcome: 'confirmed',
        bookingId: BOOKING_ID,
        bookingStatus: 'in_escrow',
    });

    const verifyIndex = harness.calls.findIndex((call) => call.sql === 'VERIFY');
    const beginIndex = harness.calls.findIndex((call) => call.sql === 'BEGIN');
    assert.ok(verifyIndex >= 0 && verifyIndex < beginIndex, 'Payku verification must happen before BEGIN');

    const update = harness.calls.find((call) => call.sql.startsWith('UPDATE bookings'));
    assert.ok(update);
    const updateSetClause = update.sql.split(' WHERE ')[0];
    assert.equal(updateSetClause.includes('transaction_id ='), false, 'the callback must never replace the stored payment key');

    const outbox = harness.calls.filter((call) => call.sql.startsWith('INSERT INTO payment_outbox'));
    assert.equal(outbox.length, 2);
    assert.ok(outbox[0].sql.includes('payment.notifications.requested'));
    assert.ok(outbox[1].sql.includes('payment.invoice.requested'));
    assert.deepEqual(harness.calls[verifyIndex].params, [PAYMENT_KEY, undefined]);
    assert.equal(harness.calls.some((call) => call.sql === 'COMMIT'), true);
});

test('verifies a sandbox payment in its original environment and does not request an invoice', async () => {
    const harness = createHarness({ booking: bookingRow({ payku_mode: 'sandbox' }) });
    const processor = createPaykuPaymentProcessor(harness);

    const result = await processor.processWebhook(callbackPayload());

    assert.equal(result.outcome, 'confirmed');
    assert.deepEqual(harness.calls.find((call) => call.sql === 'VERIFY').params, [PAYMENT_KEY, 'sandbox']);
    assert.equal(harness.calls.find((call) => call.sql.startsWith('INSERT INTO payment_webhook_events')).params[0], 'payku_sandbox');
    assert.equal(harness.calls.some((call) => call.sql.includes('payment.invoice.requested')), false);
});

test('confirms an alternative callback transaction key only after Payku resolves it to the same payment', async () => {
    const harness = createHarness({ booking: bookingRow({ payku_mode: 'production' }) });
    const references = [];
    const processor = createPaykuPaymentProcessor({ ...harness, verifyTransaction: async (reference, mode) => {
        references.push([reference, mode]);
        return verificationPayload();
    } });
    const result = await processor.processWebhook(callbackPayload({ transaction_key: 'alternative-reference' }));
    assert.equal(result.outcome, 'confirmed');
    assert.deepEqual(references, [[PAYMENT_KEY, 'production'], ['alternative-reference', 'production']]);
    assert.equal(harness.calls.some(call => call.sql === 'COMMIT'), true);
});

test('rejects a transaction-key alias that resolves to a different booking', async () => {
    const harness = createHarness();
    const processor = createPaykuPaymentProcessor({ ...harness, verifyTransaction: async (reference) =>
        reference === PAYMENT_KEY ? verificationPayload() : verificationPayload({ order: 'different-order' }) });
    const result = await processor.processWebhook(callbackPayload({ transaction_key: 'alternative-reference' }));
    assert.deepEqual(result, { outcome: 'rejected', code: 'VERIFIED_ORDER_MISMATCH' });
    assert.equal(harness.calls.some(call => call.sql === 'BEGIN'), false);
});

test('retries instead of confirming when the transaction-key lookup is unavailable', async () => {
    const harness = createHarness();
    const processor = createPaykuPaymentProcessor({ ...harness, verifyTransaction: async (reference) => {
        if (reference !== PAYMENT_KEY) throw new Error('Provider unavailable');
        return verificationPayload();
    } });
    const result = await processor.processWebhook(callbackPayload({ transaction_key: 'alternative-reference' }));
    assert.deepEqual(result, { outcome: 'retry', code: 'PAYKU_VERIFICATION_UNAVAILABLE' });
    assert.equal(harness.calls.some(call => call.sql === 'BEGIN'), false);
});

test('defers confirmation if the environment changes after verification', async () => {
    const harness = createHarness({
        booking: bookingRow({ payku_mode: 'production' }),
        lockedBooking: bookingRow({ payku_mode: 'sandbox' }),
    });
    const processor = createPaykuPaymentProcessor(harness);

    assert.deepEqual(await processor.processWebhook(callbackPayload()), {
        outcome: 'retry', code: 'PAYMENT_ENVIRONMENT_RACE',
    });
    assert.deepEqual(harness.calls.find((call) => call.sql === 'VERIFY').params, [PAYMENT_KEY, 'production']);
    assert.equal(harness.calls.some((call) => call.sql.startsWith('UPDATE bookings')), false);
});

test('rejects transaction substitution before calling Payku or opening a transaction', async () => {
    const harness = createHarness();
    const processor = createPaykuPaymentProcessor(harness);

    const result = await processor.processWebhook(callbackPayload({
        order: '9b91aa6c-fe11-4c60-92e4-ea375455a1a4',
    }));

    assert.deepEqual(result, { outcome: 'rejected', code: 'ORDER_MISMATCH' });
    assert.equal(harness.calls.some((call) => call.sql === 'VERIFY'), false);
    assert.equal(harness.calls.some((call) => call.sql === 'BEGIN'), false);
});

test('acknowledges an exact replay without repeating the transition or outbox inserts', async () => {
    const harness = createHarness({
        lockedBooking: bookingRow({ status: 'in_escrow' }),
        existingEvent: {
            booking_id: BOOKING_ID,
            payment_key: PAYMENT_KEY,
            gateway_transaction_id: GATEWAY_TRANSACTION_ID,
        },
    });
    const processor = createPaykuPaymentProcessor(harness);

    const result = await processor.processWebhook(callbackPayload());

    assert.deepEqual(result, {
        outcome: 'duplicate',
        bookingId: BOOKING_ID,
        bookingStatus: 'in_escrow',
    });
    assert.equal(harness.calls.some((call) => call.sql.startsWith('UPDATE bookings')), false);
    assert.equal(harness.calls.some((call) => call.sql.startsWith('INSERT INTO payment_outbox')), false);
    assert.equal(harness.calls.some((call) => call.sql === 'COMMIT'), true);
});

test('rolls back when the compare-and-set transition loses a race', async () => {
    const harness = createHarness({ updateRows: [] });
    const processor = createPaykuPaymentProcessor(harness);

    const result = await processor.processWebhook(callbackPayload());

    assert.deepEqual(result, { outcome: 'retry', code: 'PAYMENT_STATE_RACE' });
    assert.equal(harness.calls.some((call) => call.sql === 'ROLLBACK'), true);
    assert.equal(harness.calls.some((call) => call.sql.startsWith('INSERT INTO payment_outbox')), false);
});

test('fails closed when Payku verification is unavailable', async () => {
    const harness = createHarness();
    harness.verifyTransaction = async () => {
        throw new Error('gateway unavailable');
    };
    const processor = createPaykuPaymentProcessor(harness);

    const result = await processor.processWebhook(callbackPayload());

    assert.deepEqual(result, { outcome: 'retry', code: 'PAYKU_VERIFICATION_UNAVAILABLE' });
    assert.equal(harness.calls.some((call) => call.sql === 'BEGIN'), false);
});

test('fails closed and rolls back when another paid booking owns the slot', async () => {
    const harness = createHarness();
    const processor = createPaykuPaymentProcessor({
        ...harness,
        confirmBookingSlots: async () => {
            const error = new Error('slot already confirmed');
            error.code = 'BOOKING_SLOT_CONFLICT';
            throw error;
        },
    });

    const result = await processor.processWebhook(callbackPayload());

    assert.deepEqual(result, { outcome: 'rejected', code: 'BOOKING_SLOT_CONFLICT' });
    assert.equal(harness.calls.some((call) => call.sql === 'ROLLBACK'), true);
    assert.equal(harness.calls.some((call) => call.sql.startsWith('INSERT INTO payment_webhook_events')), false);
    assert.equal(harness.calls.some((call) => call.sql.startsWith('UPDATE bookings')), false);
});
