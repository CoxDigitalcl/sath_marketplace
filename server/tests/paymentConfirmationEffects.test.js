import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaymentConfirmationEffects } from '../services/paymentConfirmationEffects.js';

const BOOKING_ID = 'fa6e9af9-f935-4b2e-8fb7-1af35503bd8f';

test('notification effect skips bookings already marked as notified', async () => {
    let externalCalls = 0;
    const pool = {
        async query(sql) {
            assert.match(String(sql), /FROM bookings b/);
            return {
                rows: [{ id: BOOKING_ID, notifications_sent: true }],
                rowCount: 1,
            };
        },
    };
    const effects = createPaymentConfirmationEffects({
        pool,
        sendContacts: async () => { externalCalls += 1; },
        sendGuestConfirmation: async () => { externalCalls += 1; },
        createNotification: async () => { externalCalls += 1; },
    });

    const result = await effects['payment.notifications.requested']({ bookingId: BOOKING_ID });

    assert.deepEqual(result, { skipped: true });
    assert.equal(externalCalls, 0);
});

test('notification effect checkpoints each delivery before marking the booking as sent', async () => {
    const order = [];
    const pool = {
        async query(sql) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            if (normalized.includes('FROM bookings b')) {
                return {
                    rows: [{
                        id: BOOKING_ID,
                        client_id: null,
                        scheduled_date: '2026-08-12',
                        selected_times: ['10:00'],
                        amount: 25000,
                        guest_email: 'cliente@example.test',
                        guest_name: 'Cliente',
                        guest_phone: '+56900000000',
                        notifications_sent: false,
                        payment_client_email_sent_at: null,
                        payment_provider_email_sent_at: null,
                        payment_guest_email_sent_at: null,
                        payment_provider_inapp_sent_at: null,
                        payment_client_inapp_sent_at: null,
                        service_title: 'Servicio de prueba',
                        client_email: 'cliente@example.test',
                        client_name: 'Cliente',
                        client_phone: '+56900000000',
                        provider_email: 'proveedor@example.test',
                        provider_phone: '+56911111111',
                        provider_name: 'Proveedor',
                        provider_id: 'ed0cd453-1fc4-4ba7-9297-c02f24f1af77',
                    }],
                    rowCount: 1,
                };
            }
            if (normalized.includes('SET notifications_sent = TRUE')) {
                order.push('mark-sent');
                return { rows: [{ id: BOOKING_ID }], rowCount: 1 };
            }
            const checkpoint = normalized.match(/SET (payment_[a-z_]+_sent_at) =/);
            if (checkpoint) {
                order.push(`checkpoint:${checkpoint[1]}`);
                return { rows: [], rowCount: 1 };
            }
            throw new Error(`Unexpected query: ${normalized}`);
        },
    };
    const effects = createPaymentConfirmationEffects({
        pool,
        sendContacts: async ({ onClientSent, onProviderSent }) => {
            order.push('client-email');
            await onClientSent();
            order.push('provider-email');
            await onProviderSent();
        },
        sendGuestConfirmation: async ({ onSent }) => {
            order.push('guest-email');
            await onSent();
            return true;
        },
        createNotification: async () => {
            order.push('in-app');
            return true;
        },
    });

    const result = await effects['payment.notifications.requested']({ bookingId: BOOKING_ID });

    assert.deepEqual(result, { skipped: false });
    assert.deepEqual(order, [
        'client-email',
        'checkpoint:payment_client_email_sent_at',
        'provider-email',
        'checkpoint:payment_provider_email_sent_at',
        'guest-email',
        'checkpoint:payment_guest_email_sent_at',
        'in-app',
        'checkpoint:payment_provider_inapp_sent_at',
        'mark-sent',
    ]);
});

test('partial email failure preserves the successful checkpoint and rejects completion', async () => {
    const checkpoints = [];
    const pool = {
        async query(sql) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            if (normalized.includes('FROM bookings b')) {
                return {
                    rows: [{
                        id: BOOKING_ID,
                        client_id: null,
                        notifications_sent: false,
                        payment_client_email_sent_at: null,
                        payment_provider_email_sent_at: null,
                        payment_guest_email_sent_at: null,
                        payment_provider_inapp_sent_at: null,
                        payment_client_inapp_sent_at: null,
                        client_email: 'cliente@example.test',
                        provider_email: 'proveedor@example.test',
                        provider_id: 'ed0cd453-1fc4-4ba7-9297-c02f24f1af77',
                    }],
                    rowCount: 1,
                };
            }
            const checkpoint = normalized.match(/SET (payment_[a-z_]+_sent_at) =/);
            if (checkpoint) {
                checkpoints.push(checkpoint[1]);
                return { rows: [], rowCount: 1 };
            }
            throw new Error(`Unexpected query: ${normalized}`);
        },
    };
    const effects = createPaymentConfirmationEffects({
        pool,
        sendContacts: async ({ onClientSent }) => {
            await onClientSent();
            const error = new Error('provider rejected');
            error.code = 'PROVIDER_EMAIL_DELIVERY_FAILED';
            throw error;
        },
        sendGuestConfirmation: async () => true,
        createNotification: async () => true,
    });

    await assert.rejects(
        effects['payment.notifications.requested']({ bookingId: BOOKING_ID }),
        (error) => error.code === 'PROVIDER_EMAIL_DELIVERY_FAILED',
    );
    assert.deepEqual(checkpoints, ['payment_client_email_sent_at']);
});

test('invoice effect never calls the provider for an already generated invoice', async () => {
    let providerCalls = 0;
    const pool = {
        async query(sql) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            if (normalized.includes('FROM platform_settings')) {
                return { rows: [], rowCount: 0 };
            }
            if (normalized.includes('FROM bookings b')) {
                return {
                    rows: [{ id: BOOKING_ID, invoice_status: 'generated' }],
                    rowCount: 1,
                };
            }
            throw new Error(`Unexpected query: ${normalized}`);
        },
    };
    const effects = createPaymentConfirmationEffects({
        pool,
        invoiceService: {
            async generatePlatformFeeBoleta() { providerCalls += 1; },
        },
    });

    const result = await effects['payment.invoice.requested']({ bookingId: BOOKING_ID });

    assert.deepEqual(result, { skipped: true, status: 'generated' });
    assert.equal(providerCalls, 0);
});
