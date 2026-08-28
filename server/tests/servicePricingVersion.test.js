import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../config/db.js';
import { createBooking, createGuestBooking } from '../controllers/bookingController.legacy.js';
import { getServiceQuote } from '../controllers/publicServiceQuoteController.js';

const SERVICE_ID = '0d4ae10c-2900-4507-8fa9-fa469cee5dce';
const CLIENT_ID = 'cabd0e9e-1c46-4a2a-90ce-123012301230';
const PROVIDER_ID = '93bbf5ad-294a-4835-ac9f-456045604560';
const originalQuery = pool.query;
const IDEMPOTENCY_KEY = 'pricing-version-test-001';

const responseRecorder = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test.afterEach(() => {
    pool.query = originalQuery;
});

test('returns the server pricing version with a public quote', async () => {
    let queryCount = 0;
    pool.query = async () => {
        queryCount += 1;
        if (queryCount === 1) {
            return {
                rows: [{
                    id: SERVICE_ID,
                    price: 8000,
                    pricing_type: 'per_event',
                    pricing_version: 4,
                    category: null,
                    categories_json: []
                }]
            };
        }
        return { rows: [] };
    };

    const res = responseRecorder();
    let nextError = null;
    await getServiceQuote({ params: { id: SERVICE_ID }, query: {} }, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.pricing.pricingVersion, 4);
    assert.equal(res.body.pricing.baseAmount, 8000);
});

test('rejects an authenticated booking when its quoted price is stale', async () => {
    const calls = [];
    pool.query = async (sql) => {
        calls.push(String(sql));
        if (String(sql).includes('FROM booking_idempotency')) return { rows: [] };
        return {
            rows: [{
                id: SERVICE_ID,
                provider_id: PROVIDER_ID,
                pricing_version: 3,
                is_active: true,
                moderation_status: 'approved',
                is_verified: true
            }]
        };
    };

    const res = responseRecorder();
    let nextError = null;
    await createBooking({
        user: { id: CLIENT_ID, email: 'cliente@example.com' },
        body: {
            service_id: SERVICE_ID,
            expected_pricing_version: 2
        },
        get: () => IDEMPOTENCY_KEY,
    }, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'PRICE_CHANGED');
    assert.equal(res.body.pricingVersion, 3);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /s\.is_active = TRUE/);
    assert.match(calls[1], /s\.moderation_status = 'approved'/);
    assert.match(calls[1], /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
});

test('applies the same stale-price protection to guest bookings', async () => {
    pool.query = async (sql) => String(sql).includes('FROM booking_idempotency') ? { rows: [] } : ({
        rows: [{
            id: SERVICE_ID,
            provider_id: PROVIDER_ID,
            pricing_version: 7,
            is_active: true,
            moderation_status: 'approved',
            is_verified: true
        }]
    });

    const res = responseRecorder();
    let nextError = null;
    await createGuestBooking({
        body: {
            service_id: SERVICE_ID,
            expected_pricing_version: 6,
            guest_name: 'Cliente Invitado',
            guest_email: 'invitado@example.com',
            guest_phone: '+56911111111'
        },
        get: () => IDEMPOTENCY_KEY,
    }, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'PRICE_CHANGED');
    assert.equal(res.body.pricingVersion, 7);
});

test('requires a pricing version before creating any booking', async () => {
    pool.query = async (sql) => String(sql).includes('FROM booking_idempotency') ? { rows: [] } : ({
        rows: [{
            id: SERVICE_ID,
            provider_id: PROVIDER_ID,
            pricing_version: 7,
            is_active: true,
            moderation_status: 'approved',
            is_verified: true
        }]
    });

    const res = responseRecorder();
    await createBooking({
        body: { service_id: SERVICE_ID },
        user: { id: CLIENT_ID },
        get: () => IDEMPOTENCY_KEY,
    }, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'PRICING_VERSION_REQUIRED');
});
