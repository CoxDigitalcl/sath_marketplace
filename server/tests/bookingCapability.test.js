import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createBookingCapability,
    verifyBookingCapability,
} from '../services/bookingCapability.js';

const BOOKING_ID = 'fa6e9af9-f935-4b2e-8fb7-1af35503bd8f';
const OTHER_BOOKING_ID = '9b91aa6c-fe11-4c60-92e4-ea375455a1a4';
const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);
const ORIGINAL_ENV = {
    NODE_ENV: process.env.NODE_ENV,
    BOOKING_CAPABILITY_SECRET: process.env.BOOKING_CAPABILITY_SECRET,
    BOOKING_CAPABILITY_SECRETS: process.env.BOOKING_CAPABILITY_SECRETS,
};

test.beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.BOOKING_CAPABILITY_SECRET = 'stage-two-test-secret-that-is-long-enough';
    delete process.env.BOOKING_CAPABILITY_SECRETS;
});

test.after(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

test('accepts a valid purpose-bound capability and rejects another booking', () => {
    const token = createBookingCapability({ bookingId: BOOKING_ID, now: NOW, ttlSeconds: 60 });

    assert.equal(verifyBookingCapability({ bookingId: BOOKING_ID, token, now: NOW }).ok, true);
    assert.deepEqual(
        verifyBookingCapability({ bookingId: OTHER_BOOKING_ID, token, now: NOW }),
        { ok: false, code: 'INVALID_BOOKING_CAPABILITY' }
    );
});

test('rejects expired and tampered capabilities', () => {
    const token = createBookingCapability({ bookingId: BOOKING_ID, now: NOW, ttlSeconds: 60 });

    assert.deepEqual(
        verifyBookingCapability({ bookingId: BOOKING_ID, token, now: NOW + 61_000 }),
        { ok: false, code: 'EXPIRED_BOOKING_CAPABILITY' }
    );

    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    assert.deepEqual(
        verifyBookingCapability({ bookingId: BOOKING_ID, token: tampered, now: NOW }),
        { ok: false, code: 'INVALID_BOOKING_CAPABILITY' }
    );
});

test('accepts an old secret during controlled rotation', () => {
    const token = createBookingCapability({ bookingId: BOOKING_ID, now: NOW, ttlSeconds: 60 });
    process.env.BOOKING_CAPABILITY_SECRET = 'new-stage-two-secret-that-is-long-enough';
    process.env.BOOKING_CAPABILITY_SECRETS = 'stage-two-test-secret-that-is-long-enough';

    assert.equal(verifyBookingCapability({ bookingId: BOOKING_ID, token, now: NOW }).ok, true);
});
