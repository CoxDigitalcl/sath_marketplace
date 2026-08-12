import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { pool } from '../config/db.js';
import {
    BookingIntegrityError,
    confirmBookingSlots,
    createBookingPaymentIntent,
} from '../services/bookingIntegrity.js';

const schema = process.env.BOOKING_INTEGRITY_TEST_SCHEMA || 'stage2_booking_integrity_test';
if (!/^stage2_booking_integrity_test_[a-z0-9_]{1,32}$/.test(schema)) {
    throw new Error('BOOKING_INTEGRITY_TEST_SCHEMA must be an isolated stage2 test schema.');
}
const quotedSchema = `"${schema}"`;
const setSearchPath = `SET search_path TO ${quotedSchema}, public`;

const scopedPool = {
    async connect() {
        const client = await pool.connect();
        await client.query(setSearchPath);
        return client;
    },
    async query(sql, params) {
        const client = await this.connect();
        try {
            return await client.query(sql, params);
        } finally {
            client.release();
        }
    },
};

const nextWeekday = (weekday) => {
    const cursor = new Date();
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    while (cursor.getUTCDay() !== weekday) cursor.setUTCDate(cursor.getUTCDate() + 1);
    return cursor.toISOString().slice(0, 10);
};

const fakePayku = async (bookingId) => ({
    id: `test-${bookingId}`,
    url: `https://example.invalid/pay/${bookingId}`,
    token: 'test-token',
});

const insertQuery = `
    INSERT INTO bookings (
        client_id, service_id, provider_id, status, amount,
        scheduled_date, selected_times, created_at, updated_at
    ) VALUES ($1, $2, $3, 'pending_payment', $4, $5, $6::jsonb,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
`;

const run = async () => {
    process.env.BOOKING_CAPABILITY_SECRET = 'isolated-database-test-secret-at-least-32-chars';

    await pool.query(`CREATE SCHEMA ${quotedSchema}`);
    const bootstrap = await pool.connect();
    try {
        await bootstrap.query(setSearchPath);
        await bootstrap.query(`
            CREATE TABLE users (
                id UUID PRIMARY KEY
            );
            CREATE TABLE services (
                id UUID PRIMARY KEY,
                provider_id UUID NOT NULL,
                duration_minutes INTEGER,
                calendar_config JSONB,
                availability_type VARCHAR(24),
                pricing_type VARCHAR(24),
                is_active BOOLEAN DEFAULT TRUE
            );
            CREATE TABLE bookings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID,
                service_id UUID NOT NULL,
                provider_id UUID NOT NULL,
                status VARCHAR(50) NOT NULL,
                amount INTEGER NOT NULL,
                transaction_id VARCHAR(255),
                scheduled_date TIMESTAMPTZ,
                selected_times JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const migration = await fs.readFile(
            new URL('./migrations/add_booking_integrity.sql', import.meta.url),
            'utf8'
        );
        await bootstrap.query(migration);
    } finally {
        bootstrap.release();
    }

    const providerId = '11111111-1111-4111-8111-111111111111';
    const clientId = '22222222-2222-4222-8222-222222222222';
    const serviceId = '33333333-3333-4333-8333-333333333333';
    const bookingDate = nextWeekday(3);
    const service = {
        id: serviceId,
        provider_id: providerId,
        duration_minutes: 60,
        availability_type: 'agenda',
        pricing_type: 'per_event',
        calendar_config: {
            schedule: [{
                day: 'Miércoles',
                active: true,
                timeRanges: [{ start: '09:00', end: '12:00' }],
            }],
        },
    };
    await scopedPool.query('INSERT INTO users (id) VALUES ($1), ($2)', [providerId, clientId]);
    await scopedPool.query(
        `INSERT INTO services (
            id, provider_id, duration_minutes, calendar_config,
            availability_type, pricing_type
         ) VALUES ($1, $2, 60, $3::jsonb, 'agenda', 'per_event')`,
        [serviceId, providerId, JSON.stringify(service.calendar_config)]
    );

    const requestFor = (index) => ({
        actorScope: `user:${clientId}`,
        idempotencyKey: `parallel-booking-request-${String(index).padStart(3, '0')}`,
        requestPayload: {
            service_id: serviceId,
            booking_date: bookingDate,
            selected_times: ['10:00'],
            attempt: index,
        },
        bookingDate,
        selectedTimes: ['10:00'],
        service,
        insertQuery,
        insertValues: (scheduledDate) => [
            clientId,
            serviceId,
            providerId,
            10000,
            scheduledDate,
            JSON.stringify(['10:00']),
        ],
        pricing: { totalAmount: 10000 },
        payerEmail: 'integrity-test@example.invalid',
        subject: 'Isolated integrity test',
        pool: scopedPool,
        createTransaction: fakePayku,
    });

    const attempts = await Promise.all(
        Array.from({ length: 50 }, (_, index) =>
            createBookingPaymentIntent(requestFor(index))
                .then((result) => ({ ok: true, result, index }))
                .catch((error) => ({ ok: false, error, index }))
        )
    );
    const winners = attempts.filter((attempt) => attempt.ok);
    const conflicts = attempts.filter((attempt) =>
        !attempt.ok &&
        attempt.error instanceof BookingIntegrityError &&
        attempt.error.code === 'BOOKING_SLOT_CONFLICT'
    );
    assert.equal(winners.length, 1, 'exactly one parallel booking must win');
    assert.equal(conflicts.length, 49, 'all losing bookings must fail with slot conflict');

    const winningRequest = requestFor(winners[0].index);
    const replay = await createBookingPaymentIntent(winningRequest);
    assert.equal(replay.replayed, true);
    assert.equal(replay.body.booking.id, winners[0].result.body.booking.id);

    await assert.rejects(
        createBookingPaymentIntent({
            ...winningRequest,
            requestPayload: { ...winningRequest.requestPayload, service_commune: 'Otra comuna' },
        }),
        (error) => error.code === 'IDEMPOTENCY_KEY_REUSED'
    );

    await scopedPool.query(
        `UPDATE booking_slots
         SET state = 'released', hold_expires_at = NULL
         WHERE booking_id = $1`,
        [winners[0].result.body.booking.id]
    );

    const pair = [];
    for (let index = 0; index < 2; index += 1) {
        const booking = await scopedPool.query(
            `INSERT INTO bookings (
                client_id, service_id, provider_id, status, amount,
                scheduled_date, selected_times
             ) VALUES (
                $1, $2, $3, 'pending_payment', 10000,
                (($4::date + '11:00'::time) AT TIME ZONE 'America/Santiago'),
                '["11:00"]'::jsonb
             ) RETURNING id`,
            [clientId, serviceId, providerId, bookingDate]
        );
        pair.push(booking.rows[0].id);
        await scopedPool.query(
            `INSERT INTO booking_slots (
                booking_id, service_id, provider_id, starts_at, ends_at,
                state, hold_expires_at
             ) VALUES (
                $1, $2, $3,
                (($4::date + '11:00'::time) AT TIME ZONE 'America/Santiago'),
                (($4::date + '12:00'::time) AT TIME ZONE 'America/Santiago'),
                'held', CURRENT_TIMESTAMP - INTERVAL '1 minute'
             )`,
            [booking.rows[0].id, serviceId, providerId, bookingDate]
        );
    }

    const confirmations = await Promise.all(pair.map(async (bookingId) => {
        const client = await scopedPool.connect();
        try {
            await client.query('BEGIN');
            await confirmBookingSlots(client, bookingId);
            await client.query('COMMIT');
            return { ok: true, bookingId };
        } catch (error) {
            await client.query('ROLLBACK');
            return { ok: false, bookingId, code: error.code };
        } finally {
            client.release();
        }
    }));
    assert.equal(confirmations.filter((result) => result.ok).length, 1);
    assert.equal(
        confirmations.filter((result) => !result.ok && result.code === 'BOOKING_SLOT_CONFLICT').length,
        1
    );

    const counts = await scopedPool.query(`
        SELECT
            COUNT(*) FILTER (WHERE state = 'confirmed')::int AS confirmed,
            COUNT(*) FILTER (
                WHERE state = 'held' AND hold_expires_at > CURRENT_TIMESTAMP
            )::int AS active_holds
        FROM booking_slots
    `);

    return {
        parallel_attempts: attempts.length,
        winners: winners.length,
        slot_conflicts: conflicts.length,
        idempotent_replay: replay.replayed,
        paid_confirmation_winners: confirmations.filter((result) => result.ok).length,
        final_confirmed_slots: counts.rows[0].confirmed,
        final_active_holds: counts.rows[0].active_holds,
    };
};

let result;
try {
    result = await run();
    console.log(JSON.stringify({ status: 'ok', schema, ...result }));
} finally {
    if (/^stage2_booking_integrity_test_[a-z0-9_]{1,32}$/.test(schema)) {
        await pool.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    }
    await pool.end();
}
