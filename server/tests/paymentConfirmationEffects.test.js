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

test('notification effect completes contacts before marking the booking as sent', async () => {
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
            if (normalized.startsWith('UPDATE bookings')) {
                order.push('mark-sent');
                return { rows: [], rowCount: 1 };
            }
            throw new Error(`Unexpected query: ${normalized}`);
        },
    };
    const effects = createPaymentConfirmationEffects({
        pool,
        sendContacts: async () => { order.push('contacts'); },
        sendGuestConfirmation: async () => { order.push('guest'); },
        createNotification: async () => { order.push('in-app'); },
    });

    const result = await effects['payment.notifications.requested']({ bookingId: BOOKING_ID });

    assert.deepEqual(result, { skipped: false });
    assert.deepEqual(order, ['contacts', 'guest', 'in-app', 'mark-sent']);
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
