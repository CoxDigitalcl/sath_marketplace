import crypto from 'node:crypto';

import { pool as defaultPool } from '../config/db.js';
import { createTransaction as defaultCreateTransaction } from './payku.js';
import { createBookingCapability } from './bookingCapability.js';

export const BOOKING_TIME_ZONE = 'America/Santiago';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const PAID_STATUSES = new Set(['in_escrow', 'service_completed', 'released', 'disputed']);

const parseHoldMinutes = () => {
    const parsed = Number.parseInt(process.env.BOOKING_HOLD_MINUTES || '30', 10);
    return Number.isInteger(parsed) && parsed >= 5 && parsed <= 120 ? parsed : 30;
};

export class BookingIntegrityError extends Error {
    constructor(code, message, statusCode = 400) {
        super(message);
        this.name = 'BookingIntegrityError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

const parseJsonObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const stableJson = (value) => {
    if (Array.isArray(value)) {
        return `[${value.map(stableJson).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableJson(value[key])}`
        ).join(',')}}`;
    }
    return JSON.stringify(value);
};

export const hashBookingRequest = ({ actorScope, payload }) =>
    crypto.createHash('sha256')
        .update(stableJson({ operation: 'create-booking', actorScope, payload }))
        .digest('hex');

export const normalizeIdempotencyKey = (value) => {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
        throw new BookingIntegrityError(
            'INVALID_IDEMPOTENCY_KEY',
            'La solicitud de reserva no tiene una clave de idempotencia válida.',
            400
        );
    }
    return key;
};

const validDateParts = (date) => {
    if (!DATE_PATTERN.test(date)) return null;
    const [year, month, day] = date.split('-').map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
        utc.getUTCFullYear() !== year ||
        utc.getUTCMonth() !== month - 1 ||
        utc.getUTCDate() !== day
    ) return null;
    return { year, month, day, utc };
};

export const normalizeBookingDate = (bookingDate, scheduledDate) => {
    const direct = String(bookingDate || '').trim();
    if (validDateParts(direct)) return direct;

    const fallback = new Date(scheduledDate);
    if (!Number.isNaN(fallback.getTime())) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: BOOKING_TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(fallback);
        const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        const normalized = `${values.year}-${values.month}-${values.day}`;
        if (validDateParts(normalized)) return normalized;
    }

    throw new BookingIntegrityError(
        'INVALID_BOOKING_DATE',
        'Selecciona una fecha de reserva válida.',
        400
    );
};

const zonedParts = (date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BOOKING_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

export const toSantiagoInstant = (bookingDate, time) => {
    const parts = validDateParts(bookingDate);
    if (!parts || !TIME_PATTERN.test(String(time || ''))) {
        throw new BookingIntegrityError(
            'INVALID_BOOKING_SLOT',
            'Selecciona un horario de reserva válido.',
            400
        );
    }

    const [hour, minute] = time.split(':').map(Number);
    const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
    let candidate = targetUtc;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const actual = zonedParts(new Date(candidate));
        const representedUtc = Date.UTC(
            Number(actual.year),
            Number(actual.month) - 1,
            Number(actual.day),
            Number(actual.hour),
            Number(actual.minute),
            Number(actual.second)
        );
        const delta = targetUtc - representedUtc;
        candidate += delta;
        if (delta === 0) break;
    }

    const verified = zonedParts(new Date(candidate));
    if (
        Number(verified.year) !== parts.year ||
        Number(verified.month) !== parts.month ||
        Number(verified.day) !== parts.day ||
        Number(verified.hour) !== hour ||
        Number(verified.minute) !== minute
    ) {
        throw new BookingIntegrityError(
            'INVALID_BOOKING_SLOT',
            'El horario seleccionado no existe en la zona horaria del servicio.',
            400
        );
    }

    return new Date(candidate).toISOString();
};

const timeToMinutes = (value) => {
    if (!TIME_PATTERN.test(String(value || ''))) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const buildAgendaSlots = ({ service, bookingDate }) => {
    const dateParts = validDateParts(bookingDate);
    if (!dateParts) {
        throw new BookingIntegrityError('INVALID_BOOKING_DATE', 'Selecciona una fecha válida.', 400);
    }

    const duration = Number.parseInt(service?.duration_minutes || 60, 10);
    if (!Number.isInteger(duration) || duration < 15 || duration > 24 * 60) {
        throw new BookingIntegrityError('INVALID_SERVICE_DURATION', 'La duración del servicio no es válida.', 409);
    }

    const config = parseJsonObject(service?.calendar_config);
    const dayName = DAYS[dateParts.utc.getUTCDay()];
    const dayConfig = Array.isArray(config.schedule)
        ? config.schedule.find((entry) => entry?.day === dayName)
        : null;

    if (!dayConfig?.active || !Array.isArray(dayConfig.timeRanges)) {
        return [];
    }

    const slots = [];
    for (const range of dayConfig.timeRanges) {
        const start = timeToMinutes(range?.start);
        const end = timeToMinutes(range?.end);
        if (start === null || end === null || end <= start) continue;
        for (let current = start; current + duration <= end; current += duration) {
            slots.push(minutesToTime(current));
        }
    }

    return [...new Set(slots)].sort();
};

export const normalizeRequestedSlots = ({ service, bookingDate, selectedTimes }) => {
    const raw = Array.isArray(selectedTimes) ? selectedTimes : [];
    const unique = [...new Set(raw.map((value) => String(value || '').trim()))];

    if (service?.availability_type !== 'agenda') {
        return [];
    }

    if (unique.length === 0 || unique.length > 24 || unique.some((value) => !TIME_PATTERN.test(value))) {
        throw new BookingIntegrityError(
            'INVALID_BOOKING_SLOT',
            'Selecciona uno o más horarios válidos.',
            400
        );
    }

    if (service?.pricing_type !== 'per_hour' && unique.length !== 1) {
        throw new BookingIntegrityError(
            'INVALID_BOOKING_SLOT_COUNT',
            'Este servicio permite seleccionar un solo horario.',
            400
        );
    }

    const allowed = new Set(buildAgendaSlots({ service, bookingDate }));
    if (unique.some((value) => !allowed.has(value))) {
        throw new BookingIntegrityError(
            'BOOKING_SLOT_OUTSIDE_SCHEDULE',
            'El horario seleccionado no pertenece a la agenda publicada.',
            409
        );
    }

    return unique.sort();
};

const rollbackQuietly = async (client) => {
    try { await client.query('ROLLBACK'); } catch {}
};

const responseFromStoredIdempotency = (row) => {
    if (!row?.response_json || !row?.http_status) {
        throw new BookingIntegrityError(
            'IDEMPOTENCY_REQUEST_IN_PROGRESS',
            'La misma solicitud aún está siendo procesada. Intenta nuevamente en unos segundos.',
            409
        );
    }
    return {
        httpStatus: Number(row.http_status),
        body: row.response_json,
        replayed: true,
    };
};

const beginIdempotentRequest = async ({
    client,
    actorScope,
    idempotencyKey,
    requestHash,
}) => {
    const inserted = await client.query(
        `INSERT INTO booking_idempotency (
            actor_scope, idempotency_key, request_hash, state, expires_at
         ) VALUES ($1, $2, $3, 'processing', CURRENT_TIMESTAMP + INTERVAL '24 hours')
         ON CONFLICT (actor_scope, idempotency_key) DO NOTHING
         RETURNING actor_scope`,
        [actorScope, idempotencyKey, requestHash]
    );

    if (inserted.rows.length === 1) return null;

    const existing = await client.query(
        `SELECT request_hash, state, http_status, response_json
         FROM booking_idempotency
         WHERE actor_scope = $1 AND idempotency_key = $2
         FOR UPDATE`,
        [actorScope, idempotencyKey]
    );
    const row = existing.rows[0];

    if (!row || row.request_hash !== requestHash) {
        throw new BookingIntegrityError(
            'IDEMPOTENCY_KEY_REUSED',
            'La clave de idempotencia ya fue usada con datos diferentes.',
            409
        );
    }

    return responseFromStoredIdempotency(row);
};

const markFailedAfterPaymentError = async ({
    pool,
    actorScope,
    idempotencyKey,
    bookingId,
    publicError,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE bookings
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'pending_payment'`,
            [bookingId]
        );
        await client.query(
            `UPDATE booking_slots
             SET state = 'released', hold_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE booking_id = $1 AND state = 'held'`,
            [bookingId]
        );
        await client.query(
            `UPDATE booking_idempotency
             SET state = 'failed', http_status = 502, response_json = $3::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE actor_scope = $1 AND idempotency_key = $2`,
            [actorScope, idempotencyKey, JSON.stringify(publicError)]
        );
        await client.query('COMMIT');
    } catch (error) {
        await rollbackQuietly(client);
        throw error;
    } finally {
        client.release();
    }
};

export const createBookingPaymentIntent = async ({
    actorScope,
    idempotencyKey: rawIdempotencyKey,
    requestPayload,
    bookingDate,
    selectedTimes,
    service,
    insertQuery,
    insertValues,
    pricing,
    payerEmail,
    subject,
    pool = defaultPool,
    createTransaction = defaultCreateTransaction,
}) => {
    const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
    if (typeof actorScope !== 'string' || actorScope.length < 3 || actorScope.length > 160) {
        throw new BookingIntegrityError('INVALID_BOOKING_ACTOR', 'No se pudo identificar al solicitante.', 400);
    }

    const normalizedSlots = normalizeRequestedSlots({ service, bookingDate, selectedTimes });
    const scheduledTime = normalizedSlots[0] || '12:00';
    const scheduledDate = toSantiagoInstant(bookingDate, scheduledTime);
    const requestHash = hashBookingRequest({ actorScope, payload: requestPayload });
    const holdMinutes = parseHoldMinutes();
    const client = await pool.connect();
    let booking;

    try {
        await client.query('BEGIN');
        const replay = await beginIdempotentRequest({
            client,
            actorScope,
            idempotencyKey,
            requestHash,
        });
        if (replay) {
            await client.query('COMMIT');
            return replay;
        }

        const bookingResult = await client.query(insertQuery, insertValues(scheduledDate));
        if (bookingResult.rows.length !== 1) {
            throw new BookingIntegrityError('BOOKING_CREATE_FAILED', 'No se pudo crear la reserva.', 500);
        }
        booking = bookingResult.rows[0];

        for (const time of normalizedSlots) {
            const slotStart = toSantiagoInstant(bookingDate, time);
            if (new Date(slotStart).getTime() <= Date.now()) {
                throw new BookingIntegrityError(
                    'BOOKING_SLOT_IN_PAST',
                    'El horario seleccionado ya no está disponible.',
                    409
                );
            }

            await client.query(
                `INSERT INTO booking_slots (
                    booking_id, service_id, provider_id, starts_at, ends_at,
                    state, hold_expires_at
                 ) VALUES (
                    $1, $2, $3, $4::timestamptz,
                    $4::timestamptz + make_interval(mins => $5),
                    'held', CURRENT_TIMESTAMP + make_interval(mins => $6)
                 )`,
                [
                    booking.id,
                    service.id,
                    service.provider_id,
                    slotStart,
                    Number.parseInt(service.duration_minutes || 60, 10),
                    holdMinutes,
                ]
            );
        }

        await client.query(
            `UPDATE booking_idempotency
             SET booking_id = $3, updated_at = CURRENT_TIMESTAMP
             WHERE actor_scope = $1 AND idempotency_key = $2`,
            [actorScope, idempotencyKey, booking.id]
        );
        await client.query('COMMIT');
    } catch (error) {
        await rollbackQuietly(client);
        if (error?.code === '23P01') {
            throw new BookingIntegrityError(
                'BOOKING_SLOT_CONFLICT',
                'Ese horario acaba de ser reservado. Elige otro bloque disponible.',
                409
            );
        }
        throw error;
    } finally {
        client.release();
    }

    let transaction;
    try {
        const capability = createBookingCapability({ bookingId: booking.id });
        transaction = await createTransaction(
            booking.id,
            pricing.totalAmount,
            payerEmail,
            subject,
            capability
        );
    } catch (error) {
        const publicError = {
            status: 'error',
            code: 'PAYMENT_INITIALIZATION_FAILED',
            message: 'No se pudo iniciar el pago. La reserva temporal fue liberada.',
        };
        await markFailedAfterPaymentError({
            pool,
            actorScope,
            idempotencyKey,
            bookingId: booking.id,
            publicError,
        });
        return { httpStatus: 502, body: publicError, replayed: false };
    }

    const body = {
        status: 'success',
        message: 'Booking initialized. Redirecting to payment...',
        booking: {
            ...booking,
            scheduled_date: scheduledDate,
            transaction_id: transaction.id || null,
            pricing,
        },
        paymentUrl: transaction.url,
        token: transaction.token,
    };

    const persistenceClient = await pool.connect();
    try {
        await persistenceClient.query('BEGIN');
        if (transaction.id) {
            await persistenceClient.query(
                `UPDATE bookings
                 SET transaction_id = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND status = 'pending_payment'`,
                [transaction.id, booking.id]
            );
        }
        await persistenceClient.query(
            `UPDATE booking_idempotency
             SET state = 'completed', http_status = 201, response_json = $3::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE actor_scope = $1 AND idempotency_key = $2 AND booking_id = $4`,
            [actorScope, idempotencyKey, JSON.stringify(body), booking.id]
        );
        await persistenceClient.query('COMMIT');
    } catch (error) {
        await rollbackQuietly(persistenceClient);
        throw new BookingIntegrityError(
            'PAYMENT_INTENT_PERSISTENCE_FAILED',
            'El pago fue iniciado, pero no pudimos guardar su referencia. Contacta a soporte antes de reintentar.',
            503
        );
    } finally {
        persistenceClient.release();
    }

    return { httpStatus: 201, body, replayed: false };
};

export const confirmBookingSlots = async (client, bookingId) => {
    const slotResult = await client.query(
        `SELECT id, provider_id, starts_at, ends_at
         FROM booking_slots
         WHERE booking_id = $1
         ORDER BY starts_at
         FOR UPDATE`,
        [bookingId]
    );

    if (slotResult.rows.length === 0) return { displacedBookingIds: [] };

    const providerId = slotResult.rows[0].provider_id;
    await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 19417))',
        [providerId]
    );

    const confirmedConflict = await client.query(
        `SELECT conflicting.booking_id
         FROM booking_slots own
         JOIN booking_slots conflicting
           ON conflicting.provider_id = own.provider_id
          AND conflicting.booking_id <> own.booking_id
          AND conflicting.state = 'confirmed'
          AND conflicting.starts_at < own.ends_at
          AND conflicting.ends_at > own.starts_at
         WHERE own.booking_id = $1
         LIMIT 1`,
        [bookingId]
    );

    if (confirmedConflict.rows.length > 0) {
        throw new BookingIntegrityError(
            'BOOKING_SLOT_CONFLICT',
            'El horario ya fue confirmado por otra reserva.',
            409
        );
    }

    const displaced = await client.query(
        `UPDATE booking_slots conflicting
         SET state = 'released', hold_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE conflicting.booking_id <> $1
           AND conflicting.state = 'held'
           AND EXISTS (
               SELECT 1
               FROM booking_slots own
               WHERE own.booking_id = $1
                 AND own.provider_id = conflicting.provider_id
                 AND conflicting.starts_at < own.ends_at
                 AND conflicting.ends_at > own.starts_at
           )
         RETURNING conflicting.booking_id`,
        [bookingId]
    );
    const displacedBookingIds = [...new Set(displaced.rows.map((row) => row.booking_id))];

    if (displacedBookingIds.length > 0) {
        await client.query(
            `UPDATE bookings
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($1::uuid[]) AND status = 'pending_payment'`,
            [displacedBookingIds]
        );
    }

    const confirmed = await client.query(
        `UPDATE booking_slots
         SET state = 'confirmed', hold_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = $1
           AND state IN ('held', 'released')
         RETURNING id`,
        [bookingId]
    );

    if (confirmed.rows.length !== slotResult.rows.length) {
        throw new BookingIntegrityError(
            'BOOKING_SLOT_STATE_CONFLICT',
            'No se pudieron confirmar todos los bloques de la reserva.',
            409
        );
    }

    return { displacedBookingIds };
};

export const isPaidBookingStatus = (status) => PAID_STATUSES.has(status);

export default {
    BookingIntegrityError,
    buildAgendaSlots,
    confirmBookingSlots,
    createBookingPaymentIntent,
    hashBookingRequest,
    normalizeBookingDate,
    normalizeIdempotencyKey,
    normalizeRequestedSlots,
    toSantiagoInstant,
};
