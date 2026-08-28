import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BookingIntegrityError,
    buildAgendaSlots,
    createBookingPaymentIntent,
    getBookingPaymentIntentReplay,
    hashBookingRequest,
    normalizeBookingDate,
    normalizeIdempotencyKey,
    normalizeRequestedSlots,
    toSantiagoInstant,
} from '../services/bookingIntegrity.js';
import { validateBookingTransition } from '../services/bookingStateMachine.js';

const agendaService = {
    availability_type: 'agenda',
    pricing_type: 'per_event',
    duration_minutes: 60,
    calendar_config: {
        schedule: [
            {
                day: 'Miércoles',
                active: true,
                timeRanges: [{ start: '09:00', end: '12:00' }],
            },
        ],
    },
};

test('normalizes Chilean calendar dates and converts winter/summer offsets explicitly', () => {
    assert.equal(normalizeBookingDate('2026-08-12', null), '2026-08-12');
    assert.equal(toSantiagoInstant('2026-08-12', '10:00'), '2026-08-12T14:00:00.000Z');
    assert.equal(toSantiagoInstant('2026-01-14', '10:00'), '2026-01-14T13:00:00.000Z');
});

test('generates only published blocks and rejects a forged time', () => {
    assert.deepEqual(
        buildAgendaSlots({ service: agendaService, bookingDate: '2026-08-12' }),
        ['09:00', '10:00', '11:00']
    );
    assert.deepEqual(
        normalizeRequestedSlots({
            service: agendaService,
            bookingDate: '2026-08-12',
            selectedTimes: ['10:00'],
        }),
        ['10:00']
    );
    assert.throws(
        () => normalizeRequestedSlots({
            service: agendaService,
            bookingDate: '2026-08-12',
            selectedTimes: ['10:30'],
        }),
        (error) => error instanceof BookingIntegrityError &&
            error.code === 'BOOKING_SLOT_OUTSIDE_SCHEDULE'
    );
});

test('stable request hash is independent of object key order', () => {
    const first = hashBookingRequest({
        actorScope: 'user:one',
        payload: { service_id: 'a', selected_times: ['10:00'], nested: { b: 2, a: 1 } },
    });
    const second = hashBookingRequest({
        actorScope: 'user:one',
        payload: { nested: { a: 1, b: 2 }, selected_times: ['10:00'], service_id: 'a' },
    });
    assert.equal(first, second);
});

test('idempotency keys reject missing and unsafe values', () => {
    assert.equal(normalizeIdempotencyKey('booking-request-1234'), 'booking-request-1234');
    assert.throws(
        () => normalizeIdempotencyKey('short'),
        (error) => error.code === 'INVALID_IDEMPOTENCY_KEY'
    );
});

test('state machine rejects role bypasses and invalid races', () => {
    assert.deepEqual(validateBookingTransition({
        currentStatus: 'in_escrow',
        targetStatus: 'service_completed',
        role: 'provider',
        actorId: 'provider-1',
        providerId: 'provider-1',
        clientId: 'client-1',
    }), { ok: true });

    assert.equal(validateBookingTransition({
        currentStatus: 'pending_payment',
        targetStatus: 'released',
        role: 'admin',
        actorId: 'admin-1',
        providerId: 'provider-1',
        clientId: 'client-1',
    }).code, 'INVALID_BOOKING_TRANSITION');

    assert.equal(validateBookingTransition({
        currentStatus: 'in_escrow',
        targetStatus: 'service_completed',
        role: 'provider',
        actorId: 'provider-2',
        providerId: 'provider-1',
        clientId: 'client-1',
    }).code, 'BOOKING_TRANSITION_FORBIDDEN');
});

test('only an explicitly verified flexible checkout can bypass fixed agenda slots', () => {
    assert.deepEqual(
        normalizeRequestedSlots({
            service: agendaService,
            bookingDate: '2026-08-12',
            selectedTimes: ['a_convenir'],
            allowFlexibleSchedule: true,
        }),
        []
    );
    assert.throws(
        () => normalizeRequestedSlots({
            service: agendaService,
            bookingDate: '2026-08-12',
            selectedTimes: ['a_convenir'],
        }),
        (error) => error.code === 'INVALID_BOOKING_SLOT'
    );
});

test('replays a completed idempotent booking before revalidating mutable service state', async () => {
    const storedBody = { status: 'success', booking: { id: 'booking-1' } };
    const requestPayload = { service_id: 'service-1', expected_pricing_version: 1 };
    const actorScope = 'user:client-1';
    const replay = await getBookingPaymentIntentReplay({
        actorScope,
        idempotencyKey: 'booking-replay-test-001',
        requestPayload,
        pool: {
            async query(sql, values) {
                assert.match(sql, /FROM booking_idempotency/u);
                assert.deepEqual(values, [actorScope, 'booking-replay-test-001']);
                return {
                    rows: [{
                        request_hash: hashBookingRequest({ actorScope, payload: requestPayload }),
                        state: 'completed',
                        http_status: 201,
                        response_json: storedBody,
                    }],
                };
            },
        },
    });

    assert.deepEqual(replay, { httpStatus: 201, body: storedBody, replayed: true });
});

test('locks and rechecks pricing_version inside the booking transaction', async () => {
    const calls = [];
    const client = {
        async query(sql) {
            const normalized = String(sql).replace(/\s+/gu, ' ').trim();
            calls.push(normalized);
            if (normalized === 'BEGIN' || normalized === 'ROLLBACK') return { rows: [] };
            if (normalized.startsWith('INSERT INTO booking_idempotency')) {
                return { rows: [{ actor_scope: 'user:client' }] };
            }
            if (normalized.startsWith('SELECT s.pricing_version FROM services')) {
                return { rows: [{ pricing_version: 2 }] };
            }
            throw new Error(`Unexpected SQL: ${normalized}`);
        },
        release() {},
    };
    const pool = { async connect() { return client; } };
    let paymentCalls = 0;

    await assert.rejects(
        createBookingPaymentIntent({
            actorScope: 'user:client',
            idempotencyKey: 'booking-price-race-001',
            requestPayload: { service_id: 'service-1', expected_pricing_version: 1 },
            bookingDate: '2026-09-02',
            selectedTimes: [],
            service: {
                id: 'service-1',
                provider_id: 'provider-1',
                availability_type: 'inmediato',
                duration_minutes: 60,
            },
            expectedPricingVersion: 1,
            insertQuery: 'INSERT INTO bookings DEFAULT VALUES RETURNING *',
            insertValues: () => [],
            pricing: { totalAmount: 10000 },
            payerEmail: 'client@example.com',
            subject: 'Reserva',
            pool,
            createTransaction: async () => {
                paymentCalls += 1;
                return {};
            },
        }),
        (error) => error instanceof BookingIntegrityError &&
            error.code === 'PRICE_CHANGED' && error.statusCode === 409
    );

    assert.equal(paymentCalls, 0);
    assert.equal(calls.some((sql) =>
        sql.includes("s.moderation_status = 'approved'") &&
        sql.includes('p.is_verified = TRUE') &&
        sql.includes('u.is_blocked') &&
        sql.includes('FOR SHARE OF s, p, u')
    ), true);
    assert.equal(calls.some((sql) => sql.startsWith('INSERT INTO bookings')), false);
    assert.equal(calls.at(-1), 'ROLLBACK');
});
