import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createPaymentOutboxWorker } from '../services/paymentOutboxWorker.js';

const BOOKING_ID = 'fa6e9af9-f935-4b2e-8fb7-1af35503bd8f';

test('claims outbox events with SKIP LOCKED and marks successful effects once', async () => {
    let claimed = false;
    let handled = 0;
    const queries = [];
    const pool = {
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            queries.push({ sql: normalized, params });
            if (normalized.startsWith('WITH claimable AS')) {
                if (claimed) return { rows: [], rowCount: 0 };
                claimed = true;
                return {
                    rows: [{
                        id: 7,
                        event_type: 'payment.notifications.requested',
                        aggregate_id: BOOKING_ID,
                        payload: { bookingId: BOOKING_ID },
                        attempt_count: 1,
                    }],
                    rowCount: 1,
                };
            }
            if (normalized.startsWith('UPDATE payment_outbox SET processed_at')) {
                return { rows: [], rowCount: 1 };
            }
            throw new Error(`Unexpected query: ${normalized}`);
        },
    };
    const worker = createPaymentOutboxWorker({
        pool,
        handlers: {
            'payment.notifications.requested': async ({ bookingId }) => {
                assert.equal(bookingId, BOOKING_ID);
                handled += 1;
            },
        },
    });

    const [first, second] = await Promise.all([worker.processBatch(), worker.processBatch()]);

    assert.equal(first.claimed + second.claimed, 1);
    assert.equal(handled, 1);
    assert.equal(queries.some((query) => query.sql.includes('FOR UPDATE SKIP LOCKED')), true);
    assert.equal(queries.filter((query) => query.sql.startsWith('UPDATE payment_outbox SET processed_at')).length, 1);
});

test('releases failed events with bounded retry metadata instead of marking them processed', async () => {
    const queries = [];
    const pool = {
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            queries.push({ sql: normalized, params });
            if (normalized.startsWith('WITH claimable AS')) {
                return {
                    rows: [{
                        id: 8,
                        event_type: 'payment.invoice.requested',
                        aggregate_id: BOOKING_ID,
                        payload: { bookingId: BOOKING_ID },
                        attempt_count: 3,
                    }],
                    rowCount: 1,
                };
            }
            if (normalized.startsWith('UPDATE payment_outbox SET locked_at = NULL')) {
                return { rows: [], rowCount: 1 };
            }
            throw new Error(`Unexpected query: ${normalized}`);
        },
    };
    const worker = createPaymentOutboxWorker({
        pool,
        handlers: {
            'payment.invoice.requested': async () => {
                const error = new Error('secret-bearing provider response');
                error.code = 'DTE_UNAVAILABLE';
                throw error;
            },
        },
    });

    const result = await worker.processBatch();

    assert.deepEqual(result, { claimed: 1, processed: 0, failed: 1 });
    const failureUpdate = queries.find((query) => query.sql.startsWith('UPDATE payment_outbox SET locked_at = NULL'));
    assert.ok(failureUpdate);
    assert.deepEqual(failureUpdate.params, [8, 'DTE_UNAVAILABLE']);
    assert.equal(queries.some((query) => query.sql.includes('processed_at = CURRENT_TIMESTAMP')), false);
});

test('payment migration defines unique bindings and a retryable outbox', async () => {
    const migrationUrl = new URL('../scripts/migrations/add_payku_payment_integrity.sql', import.meta.url);
    const sql = await readFile(migrationUrl, 'utf8');

    assert.match(sql, /UNIQUE INDEX IF NOT EXISTS ux_bookings_payku_payment_key/i);
    assert.match(sql, /UNIQUE \(provider, payment_key\)/i);
    assert.match(sql, /UNIQUE \(provider, gateway_transaction_id\)/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS payment_outbox/i);
    assert.match(sql, /deduplication_key[^\n]+UNIQUE/i);
    assert.match(sql, /attempt_count/i);
    assert.match(sql, /available_at/i);
    assert.match(sql, /processed_at/i);
});

test('notification delivery migration adds resumable per-recipient checkpoints', async () => {
    const migrationUrl = new URL('../scripts/migrations/add_payment_notification_delivery_integrity.sql', import.meta.url);
    const sql = await readFile(migrationUrl, 'utf8');

    assert.match(sql, /payment_client_email_sent_at/i);
    assert.match(sql, /payment_provider_email_sent_at/i);
    assert.match(sql, /payment_guest_email_sent_at/i);
    assert.match(sql, /payment_provider_inapp_sent_at/i);
    assert.match(sql, /payment_client_inapp_sent_at/i);
    assert.match(sql, /WHERE notifications_sent IS TRUE/i);
});
