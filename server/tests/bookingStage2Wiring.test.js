import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('public booking reads require a signed capability and rate limiting', () => {
    const routes = read('server/routes/bookingRoute.js');
    assert.match(routes, /publicBookingReadLimiter, requireBookingCapability, verifyPayment/);
    assert.match(routes, /publicBookingReadLimiter, requireBookingCapability, getPublicBookingById/);
});

test('checkout sends canonical date and an idempotency key', () => {
    const checkout = read('src/components/public/CheckoutPage.tsx');
    assert.match(checkout, /booking_date: booking\.date/);
    assert.match(checkout, /'Idempotency-Key': idempotencyKeyRef\.current/);
});

test('Payku return carries the signed capability in a fragment', () => {
    const payku = read('server/services/payku.legacy.js');
    assert.match(payku, /#cap=/);
    assert.match(payku, /encodeURIComponent\(bookingCapability\)/);
});

test('database migration serializes provider ranges and rejects overlap', () => {
    const migration = read('server/scripts/migrations/add_booking_integrity.sql');
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /ERRCODE = '23P01'/);
    assert.match(migration, /existing\.starts_at < NEW\.ends_at/);
    assert.match(migration, /existing\.ends_at > NEW\.starts_at/);
});
