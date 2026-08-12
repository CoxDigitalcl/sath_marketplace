import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import {
    BOOKING_TIME_ZONE,
    BookingIntegrityError,
    buildAgendaSlots,
    normalizeBookingDate,
    toSantiagoInstant,
} from '../services/bookingIntegrity.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const checkAvailability = async (req, res, next) => {
    try {
        const serviceId = String(req.query.serviceId || '');
        const bookingDate = normalizeBookingDate(req.query.date, null);

        if (!UUID_PATTERN.test(serviceId)) {
            return res.status(400).json({ status: 'error', message: 'Servicio inválido.' });
        }

        const serviceResult = await pool.query(
            `SELECT id, provider_id, availability_type, pricing_type,
                    duration_minutes, calendar_config
             FROM services
             WHERE id = $1 AND is_active = TRUE`,
            [serviceId]
        );
        if (serviceResult.rows.length !== 1) {
            return res.status(404).json({ status: 'error', message: 'Servicio no encontrado.' });
        }

        const service = serviceResult.rows[0];
        if (service.availability_type !== 'agenda') {
            return res.json({
                status: 'success',
                date: bookingDate,
                availableSlots: [],
                message: 'Este servicio se coordina directamente y no usa bloques de agenda.',
            });
        }

        const candidates = buildAgendaSlots({ service, bookingDate });
        if (candidates.length === 0) {
            return res.json({
                status: 'success',
                date: bookingDate,
                availableSlots: [],
                message: 'No hay horarios disponibles para este día.',
            });
        }

        const duration = Number.parseInt(service.duration_minutes || 60, 10);
        const availableResult = await pool.query(
            `SELECT candidate.time_text
             FROM unnest($2::text[]) WITH ORDINALITY AS candidate(time_text, position)
             WHERE (($3::date + candidate.time_text::time) AT TIME ZONE $4) > CURRENT_TIMESTAMP
               AND NOT EXISTS (
                   SELECT 1
                   FROM booking_slots occupied
                   WHERE occupied.provider_id = $1
                     AND (
                         occupied.state = 'confirmed'
                         OR (
                             occupied.state = 'held'
                             AND occupied.hold_expires_at > CURRENT_TIMESTAMP
                         )
                     )
                     AND occupied.starts_at <
                         ((($3::date + candidate.time_text::time) AT TIME ZONE $4)
                          + make_interval(mins => $5))
                     AND occupied.ends_at >
                         (($3::date + candidate.time_text::time) AT TIME ZONE $4)
               )
             ORDER BY candidate.position`,
            [service.provider_id, candidates, bookingDate, BOOKING_TIME_ZONE, duration]
        );

        const availableSlots = availableResult.rows.map((row) => row.time_text);
        return res.json({
            status: 'success',
            date: bookingDate,
            availableSlots,
            message: availableSlots.length === 0
                ? 'No quedan horarios disponibles para este día.'
                : undefined,
        });
    } catch (error) {
        if (error instanceof BookingIntegrityError) {
            return res.status(error.statusCode).json({
                status: 'error',
                code: error.code,
                message: error.message,
            });
        }
        logger.error('[Booking Availability] Failed', { code: error?.code || 'UNKNOWN' });
        return next(error);
    }
};

export default { checkAvailability };
