import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BookingIntegrityError,
    buildAgendaSlots,
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
