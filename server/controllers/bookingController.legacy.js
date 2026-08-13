import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { createInAppNotification } from './notificationController.js';
import { calculateServicePricing, ensureBookingPricingColumns, getBookingPricingFromRow } from '../services/commissionService.js';
import { validateCheckoutCoverage } from '../../shared/chileLocations.js';
import {
    BookingIntegrityError,
    createBookingPaymentIntent,
    createGuestActorScope,
    normalizeBookingDate,
} from '../services/bookingIntegrity.js';

let freightColumnsPromise = null;

const ensureBookingFreightColumns = async () => {
    if (!freightColumnsPromise) {
        freightColumnsPromise = pool.query(`
            ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS freight_origin_address TEXT,
            ADD COLUMN IF NOT EXISTS freight_origin_lat DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS freight_origin_lng DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS freight_dest_address TEXT,
            ADD COLUMN IF NOT EXISTS freight_dest_lat DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS freight_dest_lng DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS freight_distance_km DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS freight_client_volume_m3 DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS freight_logistics_plan JSONB
        `).catch((err) => {
            freightColumnsPromise = null;
            logger.error(`[Booking] Could not ensure booking freight columns: ${err.message}`);
            throw err;
        });
    }
    return freightColumnsPromise;
};

const toFiniteNumberOrNull = (value) => {
    if (typeof value === 'string') {
        if (value.trim().length === 0) return null;
    } else if (typeof value !== 'number') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const FREIGHT_PRICE_VALIDATION_MESSAGE = 'No se pudo validar el precio del flete.';
const FREIGHT_MAX_DISTANCE_KM = 1000;
const FREIGHT_MAX_DURATION_MINUTES = 10080;
const FREIGHT_MAX_CLIENT_VOLUME_M3 = 1000;
const FREIGHT_MAX_PLAN_VEHICLES = 10;
const FREIGHT_MAX_TRIPS_COUNT = 100;
const FREIGHT_ALLOWED_MODES = new Set(['single_trip', 'multi_trip', 'multi_vehicle']);

const getPositiveNumberOrNull = (value) => {
    const parsed = toFiniteNumberOrNull(value);
    return parsed !== null && parsed > 0 ? parsed : null;
};

const getPositiveIntegerOrNull = (value) => {
    const parsed = getPositiveNumberOrNull(value);
    return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};

const sanitizeTextOrNull = (value, maxLength) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
};

const getBoundedNumberOrNull = (value, min, max) => {
    const parsed = toFiniteNumberOrNull(value);
    return parsed !== null && parsed >= min && parsed <= max ? parsed : null;
};

const parseServiceCategories = (service) => {
    const rawCategories = service?.categories_json;
    if (Array.isArray(rawCategories)) return rawCategories;
    if (typeof rawCategories !== 'string') return [];

    try {
        const parsed = JSON.parse(rawCategories);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const isFreightService = (service) => {
    const hasFreightCategory = parseServiceCategories(service).some((category) => category?.categoryId === 'fletes');
    const hasFreightPricing = getPositiveNumberOrNull(service?.freight_base_price) !== null &&
        getPositiveNumberOrNull(service?.freight_price_per_km) !== null;

    return hasFreightCategory || hasFreightPricing;
};

const sanitizeFreightRoute = (freightRoute) => {
    if (!freightRoute || typeof freightRoute !== 'object' || Array.isArray(freightRoute)) {
        return null;
    }

    const originAddress = sanitizeTextOrNull(freightRoute.origin_address, 500);
    const destAddress = sanitizeTextOrNull(freightRoute.dest_address, 500);
    const originLat = getBoundedNumberOrNull(freightRoute.origin_lat, -90, 90);
    const originLng = getBoundedNumberOrNull(freightRoute.origin_lng, -180, 180);
    const destLat = getBoundedNumberOrNull(freightRoute.dest_lat, -90, 90);
    const destLng = getBoundedNumberOrNull(freightRoute.dest_lng, -180, 180);
    const distanceKm = getPositiveNumberOrNull(freightRoute.distance_km);
    const durationMinutes = getPositiveNumberOrNull(freightRoute.duration_minutes);

    if (
        !originAddress ||
        !destAddress ||
        originLat === null ||
        originLng === null ||
        destLat === null ||
        destLng === null ||
        distanceKm === null ||
        distanceKm > FREIGHT_MAX_DISTANCE_KM ||
        durationMinutes === null ||
        durationMinutes > FREIGHT_MAX_DURATION_MINUTES
    ) {
        return null;
    }

    return {
        origin_address: originAddress,
        origin_lat: originLat,
        origin_lng: originLng,
        dest_address: destAddress,
        dest_lat: destLat,
        dest_lng: destLng,
        distance_km: distanceKm,
        duration_minutes: durationMinutes
    };
};

const sanitizeFreightVehicles = (vehicles) => {
    if (!Array.isArray(vehicles) || vehicles.length === 0 || vehicles.length > FREIGHT_MAX_PLAN_VEHICLES) {
        return null;
    }

    const sanitizedVehicles = vehicles.map((vehicle) => {
        if (!vehicle || typeof vehicle !== 'object' || Array.isArray(vehicle)) return null;

        const id = sanitizeTextOrNull(vehicle.id, 120);
        const name = sanitizeTextOrNull(vehicle.name, 120);
        const volumeM3 = getPositiveNumberOrNull(vehicle.volume_m3);

        if (!id || !name || volumeM3 === null || volumeM3 > FREIGHT_MAX_CLIENT_VOLUME_M3) {
            return null;
        }

        return {
            id,
            name,
            volume_m3: volumeM3
        };
    });

    return sanitizedVehicles.every(Boolean) ? sanitizedVehicles : null;
};

const sanitizeFreightLogistics = (freightLogistics) => {
    if (!freightLogistics || typeof freightLogistics !== 'object' || Array.isArray(freightLogistics)) {
        return null;
    }

    const mode = FREIGHT_ALLOWED_MODES.has(freightLogistics.mode) ? freightLogistics.mode : null;
    const vehicles = sanitizeFreightVehicles(freightLogistics.vehicles);
    const tripsCount = getPositiveIntegerOrNull(freightLogistics.trips_count);
    const totalVehicleVolume = getPositiveNumberOrNull(freightLogistics.total_vehicle_volume_m3);
    const clientVolume = getPositiveNumberOrNull(freightLogistics.client_volume_m3);
    const explanation = sanitizeTextOrNull(freightLogistics.explanation, 1000) || null;

    if (
        !mode ||
        !vehicles ||
        tripsCount === null ||
        tripsCount > FREIGHT_MAX_TRIPS_COUNT ||
        totalVehicleVolume === null ||
        totalVehicleVolume > FREIGHT_MAX_CLIENT_VOLUME_M3 ||
        clientVolume === null ||
        clientVolume > FREIGHT_MAX_CLIENT_VOLUME_M3
    ) {
        return null;
    }

    return {
        mode,
        vehicles,
        trips_count: tripsCount,
        total_vehicle_volume_m3: totalVehicleVolume,
        client_volume_m3: clientVolume,
        explanation,
        is_recommended: Boolean(freightLogistics.is_recommended),
        price_breakdown_discarded: Boolean(freightLogistics.price_breakdown)
    };
};

const hasRequestValue = (value) => value !== undefined && value !== null && value !== '';

const sanitizeFreightBookingMetadata = (service, freightRoute, freightLogistics, totalOverride) => {
    const hasFreightMetadata = Boolean(freightRoute || freightLogistics);
    const hasTotalOverride = hasRequestValue(totalOverride);

    if (!hasFreightMetadata) {
        return hasTotalOverride
            ? { ok: false }
            : {
                ok: true,
                freightRoute: null,
                freightLogistics: null
            };
    }

    if (!isFreightService(service)) {
        return { ok: false };
    }

    if (hasTotalOverride && getPositiveNumberOrNull(totalOverride) === null) {
        return { ok: false };
    }

    const sanitizedRoute = sanitizeFreightRoute(freightRoute);
    const sanitizedLogistics = sanitizeFreightLogistics(freightLogistics);

    if (!sanitizedRoute || !sanitizedLogistics) {
        return { ok: false };
    }

    return {
        ok: true,
        freightRoute: sanitizedRoute,
        freightLogistics: sanitizedLogistics
    };
};

const getCanonicalBookingRegion = (service) => ({
    serviceRegionCode: service?.coverage_region_code || null,
    serviceRegionName: service?.coverage_region_name || null
});

const buildFreightBookingValues = (freightRoute, freightLogistics) => [
    freightRoute?.origin_address || null,
    toFiniteNumberOrNull(freightRoute?.origin_lat),
    toFiniteNumberOrNull(freightRoute?.origin_lng),
    freightRoute?.dest_address || null,
    toFiniteNumberOrNull(freightRoute?.dest_lat),
    toFiniteNumberOrNull(freightRoute?.dest_lng),
    toFiniteNumberOrNull(freightRoute?.distance_km),
    toFiniteNumberOrNull(freightLogistics?.client_volume_m3),
    freightLogistics ? JSON.stringify(freightLogistics) : null
];

// CREATE BOOKING
// CREATE BOOKING
// POST /api/bookings
export const createBooking = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        // In some middleware setups, email might be in req.user
        const clientEmail = req.user.email || 'cliente@test.com';
        const {
            service_id,
            scheduled_date,
            booking_date,
            service_commune,
            selected_times = [],
            freight_route,
            freight_logistics,
            total_override
        } = req.body;

        // 1. Fetch Service Details
        const serviceRes = await pool.query(`
            SELECT s.*, p.coverage_region_code, p.coverage_region_name, p.coverage_communes
            FROM services s
            JOIN provider_profiles p ON s.provider_id = p.user_id
            WHERE s.id = $1
        `, [service_id]);
        if (serviceRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }
        const service = serviceRes.rows[0];

        // 2. Validate: Self-Booking Prevention
        if (service.provider_id === clientId) {
            return res.status(403).json({ status: 'error', message: 'You cannot book your own service.' });
        }

        // MED-04: Validate provider is verified before accepting payment
        const providerCheck = await pool.query('SELECT is_verified FROM provider_profiles WHERE user_id = $1', [service.provider_id]);
        if (!providerCheck.rows[0]?.is_verified) {
            return res.status(403).json({ status: 'error', message: 'Este proveedor aún no ha sido verificado. No se pueden crear reservas.' });
        }

        // The calendar date is interpreted explicitly in the marketplace time zone.
        const normalizedBookingDate = normalizeBookingDate(booking_date, scheduled_date);
        const todayParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const todayValues = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
        const todayInChile = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
        if (normalizedBookingDate < todayInChile) {
            return res.status(400).json({ status: 'error', message: 'La fecha de reserva debe ser hoy o una fecha futura.' });
        }

        const coverageValidation = validateCheckoutCoverage(service, { service_commune });
        if (!coverageValidation.ok) {
            return res.status(400).json({
                status: 'error',
                code: coverageValidation.reason,
                message: coverageValidation.reason === 'OUT_OF_COVERAGE'
                    ? 'El proveedor no atiende la comuna seleccionada.'
                    : 'Selecciona una comuna valida para confirmar cobertura antes del pago.'
            });
        }

        const freightValidation = sanitizeFreightBookingMetadata(service, freight_route, freight_logistics, total_override);
        if (!freightValidation.ok) {
            return res.status(400).json({ status: 'error', message: FREIGHT_PRICE_VALIDATION_MESSAGE });
        }

        // Calculate dynamic price based on pricing_type
        let calculatedPrice = Number(service.price);
        let durationHours = 1;

        if (service.pricing_type === 'per_hour' && Array.isArray(selected_times) && selected_times.length > 0) {
            durationHours = selected_times.length;
            calculatedPrice = Number(service.price) * durationHours;
        }

        const pricing = await calculateServicePricing(service, calculatedPrice);
        const canonicalRegion = getCanonicalBookingRegion(service);
        await ensureBookingPricingColumns();
        await ensureBookingFreightColumns();

        // 3. Create Booking (Escrow Status: pending_payment)
        const insertQuery = `
            INSERT INTO bookings (
                client_id, service_id, provider_id, status, amount, scheduled_date,
                service_region_code, service_region_name, service_commune,
                selected_times, duration_hours, base_amount, platform_fee, commission_rate, commission_type, fixed_commission,
                freight_origin_address, freight_origin_lat, freight_origin_lng,
                freight_dest_address, freight_dest_lat, freight_dest_lng,
                freight_distance_km, freight_client_volume_m3, freight_logistics_plan
            )
            VALUES ($1, $2, $3, 'pending_payment', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            RETURNING *
        `;

        const creation = await createBookingPaymentIntent({
            actorScope: `user:${clientId}`,
            idempotencyKey: req.get('idempotency-key'),
            requestPayload: req.body,
            bookingDate: normalizedBookingDate,
            selectedTimes: selected_times,
            service,
            allowFlexibleSchedule: Boolean(freightValidation.freightRoute),
            insertQuery,
            insertValues: (canonicalScheduledDate) => [
                clientId,
                service.id,
                service.provider_id,
                pricing.totalAmount,
                canonicalScheduledDate,
                canonicalRegion.serviceRegionCode,
                canonicalRegion.serviceRegionName,
                service_commune || null,
                JSON.stringify(selected_times),
                durationHours,
                pricing.baseAmount,
                pricing.platformFee,
                pricing.commissionRate,
                pricing.commissionType,
                pricing.fixedCommission,
                ...buildFreightBookingValues(freightValidation.freightRoute, freightValidation.freightLogistics)
            ],
            pricing,
            payerEmail: clientEmail,
            subject: `Reserva: ${service.title}`,
        });
        if (creation.replayed) res.set('Idempotent-Replay', 'true');
        return res.status(creation.httpStatus).json(creation.body);

    } catch (err) {
        logger.error(`Create Booking Error: ${err.message}`);
        if (err instanceof BookingIntegrityError) {
            return res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        }
        return next(err);
    }
};

// CREATE GUEST BOOKING
// POST /api/bookings/guest
export const createGuestBooking = async (req, res, next) => {
    try {
        const {
            service_id,
            scheduled_date,
            booking_date,
            service_commune,
            guest_name,
            guest_email,
            guest_phone,
            selected_times = [],
            freight_route,
            freight_logistics,
            total_override
        } = req.body;

        if (!guest_name || !guest_email || !guest_phone) {
            return res.status(400).json({ status: 'error', message: 'Guest contact information is strictly required.' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(guest_email)) {
            return res.status(400).json({ status: 'error', message: 'Formato de email inválido.' });
        }

        // 1. Fetch Service Details
        const serviceRes = await pool.query(`
            SELECT s.*, p.coverage_region_code, p.coverage_region_name, p.coverage_communes
            FROM services s
            JOIN provider_profiles p ON s.provider_id = p.user_id
            WHERE s.id = $1
        `, [service_id]);
        if (serviceRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }
        const service = serviceRes.rows[0];

        // MED-04: Validate provider is verified before accepting payment
        const providerCheck = await pool.query('SELECT is_verified FROM provider_profiles WHERE user_id = $1', [service.provider_id]);
        if (!providerCheck.rows[0]?.is_verified) {
            return res.status(403).json({ status: 'error', message: 'Este proveedor aún no ha sido verificado. No se pueden crear reservas.' });
        }

        // The calendar date is interpreted explicitly in the marketplace time zone.
        const normalizedBookingDate = normalizeBookingDate(booking_date, scheduled_date);
        const todayParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const todayValues = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
        const todayInChile = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
        if (normalizedBookingDate < todayInChile) {
            return res.status(400).json({ status: 'error', message: 'La fecha de reserva debe ser hoy o una fecha futura.' });
        }

        const coverageValidation = validateCheckoutCoverage(service, { service_commune });
        if (!coverageValidation.ok) {
            return res.status(400).json({
                status: 'error',
                code: coverageValidation.reason,
                message: coverageValidation.reason === 'OUT_OF_COVERAGE'
                    ? 'El proveedor no atiende la comuna seleccionada.'
                    : 'Selecciona una comuna valida para confirmar cobertura antes del pago.'
            });
        }

        const freightValidation = sanitizeFreightBookingMetadata(service, freight_route, freight_logistics, total_override);
        if (!freightValidation.ok) {
            return res.status(400).json({ status: 'error', message: FREIGHT_PRICE_VALIDATION_MESSAGE });
        }

        // Calculate dynamic price based on pricing_type
        let calculatedPrice = Number(service.price);
        let durationHours = 1;

        if (service.pricing_type === 'per_hour' && Array.isArray(selected_times) && selected_times.length > 0) {
            durationHours = selected_times.length;
            calculatedPrice = Number(service.price) * durationHours;
        }

        const pricing = await calculateServicePricing(service, calculatedPrice);
        const canonicalRegion = getCanonicalBookingRegion(service);
        await ensureBookingPricingColumns();
        await ensureBookingFreightColumns();

        // 2. Create Booking (Escrow Status: pending_payment, client_id: NULL)
        const insertQuery = `
            INSERT INTO bookings (
                client_id, service_id, provider_id, status, amount, scheduled_date,
                service_region_code, service_region_name, service_commune, guest_name, guest_email, guest_phone,
                selected_times, duration_hours, base_amount, platform_fee, commission_rate, commission_type, fixed_commission,
                freight_origin_address, freight_origin_lat, freight_origin_lng,
                freight_dest_address, freight_dest_lat, freight_dest_lng,
                freight_distance_km, freight_client_volume_m3, freight_logistics_plan
            )
            VALUES (NULL, $1, $2, 'pending_payment', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
            RETURNING *
        `;

        const creation = await createBookingPaymentIntent({
            actorScope: createGuestActorScope(guest_email),
            idempotencyKey: req.get('idempotency-key'),
            requestPayload: req.body,
            bookingDate: normalizedBookingDate,
            selectedTimes: selected_times,
            service,
            allowFlexibleSchedule: Boolean(freightValidation.freightRoute),
            insertQuery,
            insertValues: (canonicalScheduledDate) => [
                service.id,
                service.provider_id,
                pricing.totalAmount,
                canonicalScheduledDate,
                canonicalRegion.serviceRegionCode,
                canonicalRegion.serviceRegionName,
                service_commune || null,
                guest_name,
                guest_email,
                guest_phone,
                JSON.stringify(selected_times),
                durationHours,
                pricing.baseAmount,
                pricing.platformFee,
                pricing.commissionRate,
                pricing.commissionType,
                pricing.fixedCommission,
                ...buildFreightBookingValues(freightValidation.freightRoute, freightValidation.freightLogistics)
            ],
            pricing,
            payerEmail: guest_email,
            subject: `Reserva Invitado: ${service.title}`,
        });
        if (creation.replayed) res.set('Idempotent-Replay', 'true');
        return res.status(creation.httpStatus).json(creation.body);

    } catch (err) {
        logger.error(`Create Guest Booking Error: ${err.message}`);
        if (err instanceof BookingIntegrityError) {
            return res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        }
        return next(err);
    }
};

// GET MY BOOKINGS
// GET /api/bookings
export const getBookings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = '';
        const params = [userId];

        // Different query based on role
        if (role === 'provider') {
            // Providers see bookings made FOR them
            query = `
                SELECT b.*, s.title as service_title, COALESCE(u.email, b.guest_email) as client_email 
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                LEFT JOIN users u ON b.client_id = u.id
                WHERE b.provider_id = $1
                ORDER BY b.created_at DESC
            `;
        } else {
            // Clients see bookings they MADE
            query = `
                SELECT b.*, s.title as service_title, p.full_name as provider_name
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                JOIN provider_profiles p ON b.provider_id = p.user_id
                WHERE b.client_id = $1
                ORDER BY b.created_at DESC
            `;
        }

        const result = await pool.query(query, params);

        res.json({
            status: 'success',
            role: role,
            count: result.rows.length,
            bookings: result.rows.map(row => ({
                id: row.id,
                type: 'service', // Currently only services
                item_name: row.service_title,
                customer_name: role === 'provider' ? (row.client_email || 'Cliente') : (row.provider_name || 'Proveedor'),
                date: row.created_at,
                scheduled_date: row.scheduled_date,
                amount: row.amount,
                status: mapStatus(row.status),
                raw_status: row.status // For filtering purposes
            }))
        });

    } catch (err) {
        next(err);
    }
};

const mapStatus = (status) => {
    const map = {
        'pending_payment': 'Pendiente',
        'in_escrow': 'Confirmado',
        'service_completed': 'Entregado',
        'released': 'Pagado',
        'disputed': 'En Disputa',
        'cancelled': 'Cancelado'
    };
    return map[status] || status;
};

// GET /api/bookings/availability
// Check available slots for a service on a specific date
export const checkAvailability = async (req, res, next) => {
    try {
        const { serviceId, date } = req.query;

        if (!serviceId || !date) {
            return res.status(400).json({ status: 'error', message: 'Missing serviceId or date' });
        }

        // 1. Get Service Calendar Config & Duration
        const serviceRes = await pool.query('SELECT calendar_config, duration_minutes FROM services WHERE id = $1', [serviceId]);
        if (serviceRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }

        const service = serviceRes.rows[0];
        const calendarConfig = service.calendar_config || {};
        const duration = service.duration_minutes || 60; // Default 1 hour if not set

        // 2. Determine Day of Week
        const requestedDate = new Date(date);
        // weekday: 'long' returns "Monday", "Tuesday" etc. in English by default unless locale specified
        // Our DB stores Spanish days: "Lunes", "Martes"...
        // Let's create a map relative to getDay() (0=Sunday, 1=Monday...)
        const daysMap = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const dayName = daysMap[requestedDate.getDay()]; // Note: getDay() uses local time of the server if not careful with UTC. 
        // Ideally frontend sends YYYY-MM-DD and we assume local service time.
        // For MVP assuming server local time matches or DATE string is parsed correctly.
        // Actually `new Date("2024-01-23")` defaults to UTC in Node.
        // Let's rely on the input date string YYYY-MM-DD.
        // If we split manually we can be sure.
        const [year, month, day] = date.split('-').map(Number);
        const localDate = new Date(year, month - 1, day); // Local time construction
        const dayNameLocal = daysMap[localDate.getDay()];

        // 3. Get Schedule for that Day
        const schedule = calendarConfig.schedule || [];
        const dayConfig = schedule.find(d => d.day === dayNameLocal);

        if (!dayConfig || !dayConfig.active) {
            return res.json({
                status: 'success',
                availableSlots: [],
                message: 'No hay horarios disponibles para este día.'
            });
        }

        // 4. Generate All Possible Slots from Ranges
        let possibleSlots = [];
        for (const range of dayConfig.timeRanges) {
            // range.start and range.end are "HH:MM" strings
            const startMinutes = timeToMinutes(range.start);
            const endMinutes = timeToMinutes(range.end);

            let current = startMinutes;
            while (current + duration <= endMinutes) {
                possibleSlots.push(minutesToTime(current));
                current += duration; // Step by service duration based on requirements. 
            }
        }

        // 5. Fetch Existing Bookings for that Date
        // We look for bookings that overlap or match. 
        // For simplicity in MVP: specific start matches.
        // "scheduled_date" is TIMESTAMP WITH TIME ZONE.
        // We need to match the day.
        const bookingsRes = await pool.query(`
            SELECT scheduled_date 
            FROM bookings 
            WHERE service_id = $1 
            AND status != 'cancelled'
            AND DATE(scheduled_date) = $2
        `, [serviceId, date]);

        const bookedTimes = bookingsRes.rows.map(b => {
            const d = new Date(b.scheduled_date);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        });

        // 6. Filter Out Booked Slots
        const availableSlots = possibleSlots.filter(slot => !bookedTimes.includes(slot));

        res.json({
            status: 'success',
            date: date,
            day: dayNameLocal,
            availableSlots
        });

    } catch (err) {
        logger.error(`Check Availability Error: ${err.message}`);
        next(err);
    }
};

// Helper: HH:MM to minutes
const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// Helper: minutes to HH:MM
const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// ============================================================
// SHARED: Send all booking notifications (emails + in-app)
// Used by both webhook and verify endpoints to avoid duplication.
// IMPORTANT: Dedup check is non-blocking. If it fails, emails send anyway.
// ============================================================
const sendBookingNotifications = async (bookingId) => {
    logger.info(`[Notifications] >>> sendBookingNotifications called for Booking ${bookingId}`);
    
    // --- NON-BLOCKING dedup check ---
    try {
        const flagRes = await pool.query('SELECT notifications_sent FROM bookings WHERE id = $1', [bookingId]);
        if (flagRes.rows.length > 0 && flagRes.rows[0].notifications_sent === true) {
            logger.info(`[Notifications] Already sent for Booking ${bookingId}, skipping.`);
            return true;
        }
    } catch (dedupErr) {
        logger.warn('[Notifications] Dedup check failed; proceeding with send.', { bookingId, errorType: dedupErr.name });
    }

    try {

        // 2. Fetch all needed data in one query
        const contactQuery = `
            SELECT 
                b.id, b.client_id, b.scheduled_date, b.selected_times, b.amount,
                b.guest_email, b.guest_name, b.guest_phone,
                s.title as service_title,
                COALESCE(c.email, b.guest_email) as client_email, 
                COALESCE(b.guest_name, c.email, b.guest_email) as client_name, 
                COALESCE(b.guest_phone) as client_phone,
                p.contact_email as provider_email, p.public_phone as provider_phone, 
                p.full_name as provider_name, b.provider_id
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            LEFT JOIN users c ON b.client_id = c.id
            JOIN provider_profiles p ON b.provider_id = p.user_id
            WHERE b.id = $1
        `;
        const contactRes = await pool.query(contactQuery, [bookingId]);
        
        if (contactRes.rows.length === 0) {
            logger.warn(`[Notifications] No booking data found for ${bookingId}`);
            return false;
        }
        
        const row = contactRes.rows[0];
        
        if (!row.provider_email) {
            logger.warn(`[Notifications] No provider email for Booking ${bookingId}`);
            return false;
        }

        const isGuest = !row.client_id;
        const shortId = row.id.slice(0, 8).toUpperCase();
        const bookingData = {
            scheduled_date: row.scheduled_date,
            selected_times: row.selected_times,
            amount: row.amount
        };

        const notificationService = await import('../services/notificationService.js');
        let emailsSent = false;
        
        // 3. Send cross-contact emails
        if (notificationService.sendCrossContactEmails) {
            try {
                logger.info(`[Notifications] Sending cross-contact emails for Booking ${bookingId}...`);
                await notificationService.sendCrossContactEmails({
                    bookingId: shortId,
                    serviceName: row.service_title,
                    client: {
                        name: row.client_name,
                        email: row.client_email,
                        phone: row.client_phone || 'No registrado'
                    },
                    provider: {
                        name: row.provider_name || 'Proveedor',
                        email: row.provider_email,
                        phone: row.provider_phone || 'No registrado'
                    },
                    booking: bookingData
                });
                logger.info(`[Notifications] Cross-contact emails SENT for Booking ${bookingId}`);
                emailsSent = true;
            } catch (crossErr) {
                logger.error('[Notifications] Cross-contact failed.', { bookingId, errorType: crossErr.name });
            }
        } else {
            logger.error(`[Notifications] sendCrossContactEmails NOT FOUND in module!`);
        }

        // 4. Guest-specific comprehensive email
        if (isGuest) {
            if (notificationService.sendGuestBookingConfirmation) {
                const guestEmail = row.guest_email || row.client_email;
                try {
                    logger.info('[Notifications] Sending guest confirmation.', { bookingId });
                    await notificationService.sendGuestBookingConfirmation({
                        bookingId: shortId,
                        serviceName: row.service_title,
                        guest: {
                            name: row.guest_name || row.client_name,
                            email: guestEmail,
                            phone: row.guest_phone || 'No registrado'
                        },
                        provider: {
                            name: row.provider_name || 'Proveedor',
                            email: row.provider_email,
                            phone: row.provider_phone || 'No registrado'
                        },
                        booking: bookingData
                    });
                    logger.info('[Notifications] Guest email sent.', { bookingId });
                    emailsSent = true;
                } catch (guestErr) {
                    logger.error('[Notifications] Guest email failed.', { bookingId, errorType: guestErr.name });
                }
            } else {
                logger.error(`[Notifications] sendGuestBookingConfirmation NOT FOUND in module!`);
            }
        }

        // 5. In-App notifications
        try {
            createInAppNotification({
                userId: row.provider_id,
                title: 'Nueva reserva confirmada',
                message: `${row.client_name} ha reservado y pagado "${row.service_title}".`,
                type: 'booking',
                link: '/provider?view=orders'
            });
            if (row.client_id) {
                createInAppNotification({
                    userId: row.client_id,
                    title: 'Pago confirmado',
                    message: `Tu pago por "${row.service_title}" ha sido procesado. Los datos de contacto del proveedor han sido enviados a tu correo.`,
                    type: 'success',
                    link: '/client?view=orders'
                });
            }
        } catch (inAppErr) {
            logger.error(`[Notifications] InApp error: ${inAppErr.message}`);
        }

        // 6. Mark notifications as sent (non-blocking)
        if (emailsSent) {
            try {
                await pool.query('UPDATE bookings SET notifications_sent = TRUE WHERE id = $1', [bookingId]);
            } catch (markErr) {
                logger.warn(`[Notifications] Could not mark sent (${markErr.message}). Emails were sent OK.`);
            }
        }

        logger.info(`[Notifications] <<< Done for Booking ${bookingId} | emailsSent=${emailsSent}`);
        return emailsSent;
    } catch (err) {
        logger.error(`[Notifications] CRITICAL error for Booking ${bookingId}: ${err.message}`);
        logger.error(`[Notifications] Stack: ${err.stack}`);
        return false;
    }
};

// POST /api/bookings/webhook/payku
// Handles payment notifications from Payku
export const handlePaykuWebhook = async (req, res, next) => {
    try {
        logger.info('[Payku Webhook] Received notification');
        await ensureBookingPricingColumns();

        const { transaction_id, payment_key, order, status, amount } = req.body;

        // 1. Validate required fields
        if (!order) {
            logger.warn('[Payku Webhook] Missing order ID in payload');
            return res.status(200).json({ status: 'ok', message: 'Missing order ID' });
        }

        if (!transaction_id && !payment_key) {
            logger.warn('[Payku Webhook] Missing transaction identifier');
            return res.status(200).json({ status: 'ok', message: 'Missing transaction identifier' });
        }

        const txId = transaction_id || payment_key;

        // 2. Acquire a DB client for transaction
        const client = await pool.connect();
        let updatedBooking = null;
        let newStatus = null;

        try {
            await client.query('BEGIN');

            // 3. Lock the booking row to prevent race conditions with verifyPayment
            const lockRes = await client.query(
                'SELECT id, status, amount, transaction_id FROM bookings WHERE id = $1 FOR UPDATE',
                [order]
            );

            if (lockRes.rows.length === 0) {
                await client.query('COMMIT');
                logger.warn(`[Payku Webhook] Booking not found: ${order}`);
                return res.status(200).json({ status: 'ok', message: 'Booking not found' });
            }

            const booking = lockRes.rows[0];

            // 4. Skip if already processed (idempotency)
            if (booking.status !== 'pending_payment') {
                await client.query('COMMIT');
                logger.info(`[Payku Webhook] Booking ${order} already processed (status: ${booking.status}). Skipping.`);
                return res.status(200).json({ status: 'ok', message: 'Already processed' });
            }

            // 5. CRITICAL: Verify payment directly with Payku API (don't trust webhook payload)
            try {
                const payku = await import('../services/payku.js');
                const verification = await payku.verifyTransaction(txId);
                const verifiedStatus = verification.status || verification.payment_status;

                if (verifiedStatus !== 'success' && verifiedStatus !== 'approved' && verifiedStatus !== 'pagado') {
                    // Payment not actually confirmed — could be a spoofed webhook
                    await client.query('COMMIT');
                    logger.warn(`[Payku Webhook] Payment NOT verified by Payku API for order ${order}. Payku status: ${verifiedStatus}`);
                    return res.status(200).json({ status: 'ok', message: 'Payment not confirmed by Payku' });
                }

                // 6. Verify amount matches (prevent partial payment fraud)
                const verifiedAmount = parseInt(verification.amount || amount);
                if (verifiedAmount && booking.amount && verifiedAmount !== Number(booking.amount)) {
                    await client.query('COMMIT');
                    logger.error(`[Payku Webhook] AMOUNT MISMATCH for order ${order}! Expected: ${booking.amount}, Got: ${verifiedAmount}`);
                    return res.status(200).json({ status: 'ok', message: 'Amount mismatch' });
                }

                logger.info(`[Payku Webhook] Payment VERIFIED by Payku API for order ${order}`);
            } catch (verifyErr) {
                // If Payku API is unreachable, we CANNOT trust the webhook alone
                // Log the error but DON'T process the payment — the verifyPayment endpoint will retry later
                await client.query('COMMIT');
                logger.error(`[Payku Webhook] Cannot verify with Payku API: ${verifyErr.message}. Deferring to manual verification.`);
                return res.status(200).json({ status: 'ok', message: 'Verification deferred' });
            }

            // 7. Payment verified — update booking atomically
            newStatus = 'in_escrow';
            const updateRes = await client.query(
                `UPDATE bookings 
                 SET status = $1, transaction_id = $2, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 AND status = 'pending_payment'
                 RETURNING *`,
                [newStatus, txId, order]
            );

            if (updateRes.rows.length === 0) {
                // Another process already updated it between our SELECT and UPDATE (shouldn't happen with FOR UPDATE, but safety net)
                await client.query('COMMIT');
                logger.info(`[Payku Webhook] Booking ${order} was updated by another process. Skipping.`);
                return res.status(200).json({ status: 'ok', message: 'Already processed' });
            }

            updatedBooking = updateRes.rows[0];
            await client.query('COMMIT');

            logger.info(`[Payku Webhook] Booking ${order} updated to status: ${newStatus}`);

        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        // 8. Post-transaction: Invoice & Notifications (non-blocking, outside transaction)
        if (newStatus === 'in_escrow' && updatedBooking) {
            // --- INVOICE GENERATION (BOLETA) ---
            try {
                await ensureBookingPricingColumns();
                const settingsRes = await pool.query("SELECT * FROM platform_settings WHERE group_name = 'invoicing'");
                const settings = {};
                settingsRes.rows.forEach(row => settings[row.key] = row.value);
                const invoicingEnabled = settings.simplefactura_status === true || settings.simplefactura_status === 'true';

                const detailsQuery = `
                    SELECT 
                        b.id, b.amount, b.base_amount, b.platform_fee, b.commission_rate, b.commission_type, b.fixed_commission, b.client_id,
                        sc.commission_percentage as category_commission_percentage,
                        sc.commission_type as category_commission_type,
                        sc.fixed_commission as category_fixed_commission,
                        COALESCE(u.email, b.guest_email) as client_email,
                        COALESCE(u.full_name, b.guest_name, u.email, b.guest_email) as client_name,
                        'Sin RUT' as client_rut,
                        s.title as service_title
                    FROM bookings b
                    LEFT JOIN users u ON b.client_id = u.id
                    JOIN services s ON b.service_id = s.id
                    LEFT JOIN service_categories sc ON s.category = sc.id
                    WHERE b.id = $1
                `;
                const detailsRes = await pool.query(detailsQuery, [updatedBooking.id]);

                if (detailsRes.rows.length > 0 && invoicingEnabled && settings.simplefactura_username) {
                    const fullBooking = detailsRes.rows[0];
                    const pricing = getBookingPricingFromRow(fullBooking);

                    const invoiceData = {
                        id: fullBooking.id,
                        amount: pricing.platformFee,
                        client: {
                            email: fullBooking.client_email,
                            name: fullBooking.client_name,
                            rut: fullBooking.client_rut,
                            address: 'Direccion Cliente',
                            city: 'Santiago'
                        },
                        items: [{
                            name: `Tarifa de servicio plataforma - ${fullBooking.service_title}`,
                            price: pricing.platformFee
                        }]
                    };

                    if (pricing.platformFee <= 0) {
                        logger.warn(`[Billing] Skipping platform fee boleta for Booking ${fullBooking.id}: platform fee is 0.`);
                        await pool.query(
                            "UPDATE bookings SET invoice_status = 'skipped_no_platform_fee' WHERE id = $1",
                            [fullBooking.id]
                        );
                    } else {
                        const authConfig = {
                            username: settings.simplefactura_username,
                            password: settings.simplefactura_password,
                            rutEmisor: settings.simplefactura_rut_emisor,
                            environment: settings.simplefactura_environment || 'sandbox'
                        };

                        // Async Call (Don't block response)
                        import('../services/simpleFacturaService.js').then(async (module) => {
                            const sfService = module.default;
                            try {
                                const dteResult = await sfService.generatePlatformFeeBoleta(authConfig, invoiceData);
                                await pool.query(
                                    `UPDATE bookings SET 
                                        invoice_url = $1, 
                                        invoice_folio = $2, 
                                        invoice_status = 'generated' 
                                     WHERE id = $3`,
                                    [dteResult.data.url, dteResult.data.folio, fullBooking.id]
                                );
                                logger.info(`[Billing] Platform fee boleta generated for Booking ${fullBooking.id} | amount=${pricing.platformFee}`);
                            } catch (dteError) {
                                logger.error(`[Billing] Failed to generate Boleta: ${dteError.message}`);
                                await pool.query(
                                    "UPDATE bookings SET invoice_status = 'failed' WHERE id = $1",
                                    [fullBooking.id]
                                );
                            }
                        });
                    }
                } else {
                    logger.warn(`[Billing] Skipping Invoice: disabled, credentials missing, or booking details not found.`);
                }

            } catch (billingErr) {
                logger.error(`[Billing] Critical Error in Invoice logic: ${billingErr.message}`);
            }

            // --- SEND ALL NOTIFICATIONS (emails + in-app) ---
            await sendBookingNotifications(updatedBooking.id);
        }

        // Payku expects a 200 OK response
        res.status(200).json({
            status: 'success',
            message: 'Payment notification processed',
            booking_status: newStatus
        });

    } catch (err) {
        logger.error(`[Payku Webhook Error] ${err.message}`);
        // Still return 200 to avoid Payku retrying
        res.status(200).json({ status: 'ok', message: 'Internal error' });
    }
};

// PUT /api/bookings/:id/status
// Manual Status Update (Admin/Provider/Client)
export const updateBookingStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Valid DB statuses
        const validStatuses = ['pending_payment', 'in_escrow', 'service_completed', 'released', 'disputed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: `Estado inválido. Válidos: ${validStatuses.join(', ')}`
            });
        }

        // 1. Get current booking
        const bookingRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Booking not found' });
        }
        const booking = bookingRes.rows[0];

        // 2. Validate Transition (State Machine)
        const allowedTransitions = {
            'pending_payment': ['cancelled'],
            'in_escrow': ['service_completed', 'disputed', 'cancelled'],
            'service_completed': ['released', 'disputed'],
            'disputed': ['released', 'cancelled'], // Admin resolution
            'cancelled': [], // Terminal state
            'released': []   // Terminal state
        };

        // Admin override: Admins can force any transition if needed, but warning: it breaks the flow.
        // Let's enforce it for everyone for data integrity, or strictly for non-admins.
        // For now, enforcing for everyone to prevent logic errors.
        if (!allowedTransitions[booking.status].includes(status) && userRole !== 'admin') {
            return res.status(400).json({
                status: 'error',
                message: `Transición inválida: No se puede pasar de '${booking.status}' a '${status}'`
            });
        }

        // 3. Permission Check
        // Admin: Can set any status (subject to transition logic logic if we removed the admin bypass above, but typically admins might need to fix things)
        // Let's allow Admins to bypass the strict transition map for fixing data issues.

        let allowed = false;

        if (userRole === 'admin') {
            allowed = true;
        } else if (userRole === 'provider' && booking.provider_id === userId) {
            // Providers can mark paid work as done or cancel according to the state machine.
            if (['service_completed', 'cancelled'].includes(status)) {
                allowed = true;
            }
        } else if (userRole === 'client' && booking.client_id === userId) {
            if (status === 'disputed') allowed = true;
            if (status === 'cancelled' && booking.status === 'pending_payment') allowed = true;
            // Client confirming receipt (Optional feature)
            if (status === 'released' && booking.status === 'service_completed') allowed = true;
        }

        if (!allowed) {
            return res.status(403).json({ status: 'error', message: 'Cambio de estado no autorizado para tu rol' });
        }

        // 3. Update
        const updateQuery = `
            UPDATE bookings 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [status, id]);

        // 4. Log Activity
        logger.info(`Booking ${id} status updated to ${status} by ${userRole} ${userId}`);

        // 5. In-App Notifications for status changes
        try {
            const svcRes = await pool.query('SELECT title FROM services WHERE id = $1', [booking.service_id]);
            const serviceName = svcRes.rows[0]?.title || 'Servicio';
            const statusLabels = { 'service_completed': 'completado', 'released': 'pagado', 'disputed': 'en disputa', 'cancelled': 'cancelado' };
            const label = statusLabels[status];

            if (label && booking.client_id) {
                createInAppNotification({
                    userId: booking.client_id,
                    title: `Reserva ${label}`,
                    message: `Tu reserva de "${serviceName}" ha sido marcada como ${label}.`,
                    type: status === 'released' || status === 'service_completed' ? 'success' : 'warning',
                    link: '/client?view=orders'
                });
            }
            if (label && userRole !== 'provider') {
                createInAppNotification({
                    userId: booking.provider_id,
                    title: `Reserva ${label}`,
                    message: `La reserva de "${serviceName}" ha sido marcada como ${label}.`,
                    type: status === 'released' || status === 'service_completed' ? 'success' : 'warning',
                    link: '/provider?view=orders'
                });
            }
        } catch (notifErr) {
            logger.error(`[InApp] Booking status notification failed: ${notifErr.message}`);
        }

        res.json({
            status: 'success',
            message: 'Estado de reserva actualizado',
            booking: result.rows[0]
        });

    } catch (err) {
        next(err);
    }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const query = `
            SELECT b.*, s.title as service_title, s.image_urls as service_images,
                   COALESCE(b.guest_name, c.email, b.guest_email) as client_name, 
                   COALESCE(c.email, b.guest_email) as client_email, 
                   COALESCE(b.guest_phone) as client_phone,
                   p.full_name as provider_name, p.contact_email as provider_email, p.public_phone as provider_phone
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            LEFT JOIN users c ON b.client_id = c.id
            JOIN provider_profiles p ON b.provider_id = p.user_id
            WHERE b.id = $1 AND (b.client_id = $2 OR b.provider_id = $2 OR $3 = 'admin')
        `;
        
        const result = await pool.query(query, [id, userId, role]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Reserva no encontrada o sin acceso.' });
        }
        
        res.json({
            status: 'success',
            booking: result.rows[0]
        });

    } catch (err) {
        next(err);
    }
};

// GET /api/bookings/provider/:providerId/has-access
export const checkProviderAccess = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const providerId = req.params.providerId;

        if (req.user.role === 'admin' || clientId === providerId) {
            // Admins and the provider themselves always have access
            const providerRes = await pool.query('SELECT contact_email, public_phone FROM provider_profiles WHERE user_id = $1', [providerId]);
            if (providerRes.rows.length > 0) {
                return res.json({ status: 'success', hasAccess: true, contactDetails: { email: providerRes.rows[0].contact_email, phone: providerRes.rows[0].public_phone }});
            }
            return res.json({ status: 'success', hasAccess: false });
        }

        // Check if the current client has a paid booking with this provider
        const accessParams = [clientId, providerId, ['in_escrow', 'service_completed', 'released', 'disputed']];
        const query = `
            SELECT id FROM bookings 
            WHERE client_id = $1 AND provider_id = $2 AND status = ANY($3)
            LIMIT 1
        `;
        
        const bookingRes = await pool.query(query, accessParams);
        
        if (bookingRes.rows.length > 0) {
            // User has paid, return contact details
            const providerRes = await pool.query('SELECT contact_email, public_phone FROM provider_profiles WHERE user_id = $1', [providerId]);
            if (providerRes.rows.length > 0) {
                return res.json({ 
                    status: 'success', 
                    hasAccess: true, 
                    contactDetails: { 
                        email: providerRes.rows[0].contact_email, 
                        phone: providerRes.rows[0].public_phone 
                    }
                });
            }
        }
        
        return res.json({ status: 'success', hasAccess: false });
        
    } catch (err) {
        next(err);
    }
};

// GET /api/bookings/public/:id
// Guest Checkout Success endpoint using UUID
export const getPublicBookingById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // HIGH-04: Explicit allowlist — no SELECT *, no PII leakage
        const query = `
            SELECT b.id, b.status, b.amount, b.scheduled_date, b.selected_times, 
                   b.duration_hours, b.created_at,
                   s.title as service_title, s.image_urls as service_images,
                   p.full_name as provider_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN provider_profiles p ON b.provider_id = p.user_id
            WHERE b.id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Reserva no encontrada.' });
        }
        
        const booking = result.rows[0];

        // Only expose provider contact info after payment confirmed
        const paidStatuses = ['in_escrow', 'service_completed', 'released', 'disputed'];
        if (paidStatuses.includes(booking.status)) {
            const providerRes = await pool.query(
                'SELECT contact_email, public_phone FROM provider_profiles WHERE user_id = (SELECT provider_id FROM bookings WHERE id = $1)',
                [id]
            );
            if (providerRes.rows[0]) {
                booking.provider_email = providerRes.rows[0].contact_email;
                booking.provider_phone = providerRes.rows[0].public_phone;
            }
        }

        res.json({
            status: 'success',
            booking: booking
        });

    } catch (err) {
        next(err);
    }
};


// GET /api/bookings/verify/:id
// Verify payment status directly with Payku (fallback for webhook timing)
export const verifyPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        await ensureBookingPricingColumns();
        
        // 1. Get the booking
        const bookingRes = await pool.query(
            'SELECT id, status, amount, transaction_id, provider_id, client_id, service_id, guest_email, guest_name, guest_phone FROM bookings WHERE id = $1',
            [id]
        );
        
        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Reserva no encontrada.' });
        }
        
        const booking = bookingRes.rows[0];
        
        // Helper: fetch full booking details for response
        const fetchDetails = async () => {
            const detailQuery = `
                SELECT b.id, b.status, b.amount, b.base_amount, b.platform_fee,
                       b.scheduled_date, b.selected_times, b.duration_hours, b.created_at,
                       s.title as service_title, s.image_urls as service_images,
                       p.full_name as provider_name, p.contact_email as provider_email, p.public_phone as provider_phone
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                JOIN provider_profiles p ON b.provider_id = p.user_id
                WHERE b.id = $1
            `;
            const detailRes = await pool.query(detailQuery, [id]);
            return detailRes.rows[0];
        };
        
        // 2. If already confirmed (in_escrow or later), ensure notifications were sent & return details
        const paidStatuses = ['in_escrow', 'service_completed', 'released', 'disputed'];
        if (paidStatuses.includes(booking.status)) {
            // The shared helper has dedup logic (notifications_sent flag) so this is safe
            await sendBookingNotifications(id);
            
            const details = await fetchDetails();
            return res.json({
                status: 'success',
                payment_confirmed: true,
                booking: details
            });
        }
        
        // 3. Not confirmed yet - verify with Payku
        if (!booking.transaction_id) {
            return res.json({
                status: 'success',
                payment_confirmed: false,
                message: 'Transacción aún no registrada. El webhook de Payku podría estar en proceso.'
            });
        }
        
        try {
            const payku = await import('../services/payku.js');
            const paykuResult = await payku.verifyTransaction(booking.transaction_id);
            
            // Map Payku status
            const paykuStatus = paykuResult.status || paykuResult.payment_status;
            
            if (paykuStatus === 'success' || paykuStatus === 'approved' || paykuStatus === 'pagado') {
                const verifiedAmount = parseInt(paykuResult.amount, 10);
                if (verifiedAmount && booking.amount && verifiedAmount !== Number(booking.amount)) {
                    logger.error(`[Verify] Amount mismatch for booking ${id}. Expected: ${booking.amount}, got: ${verifiedAmount}`);
                    return res.status(409).json({
                        status: 'error',
                        payment_confirmed: false,
                        message: 'El monto verificado por Payku no coincide con la reserva.'
                    });
                }

                // Payment confirmed! Use transaction with SELECT FOR UPDATE to prevent race condition with webhook
                const txClient = await pool.connect();
                let wasUpdated = false;
                try {
                    await txClient.query('BEGIN');
                    const lockRes = await txClient.query(
                        'SELECT id, status FROM bookings WHERE id = $1 FOR UPDATE',
                        [id]
                    );
                    
                    if (lockRes.rows[0]?.status === 'pending_payment') {
                        await txClient.query(
                            `UPDATE bookings SET status = 'in_escrow', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                            [id]
                        );
                        wasUpdated = true;
                    }
                    await txClient.query('COMMIT');
                } catch (txErr) {
                    await txClient.query('ROLLBACK');
                    throw txErr;
                } finally {
                    txClient.release();
                }
                
                if (wasUpdated) {
                    logger.info(`[Verify] Booking ${id} confirmed via direct Payku verification`);
                }
                
                // Send notifications (dedup logic handles duplicates)
                await sendBookingNotifications(id);
                
                // Return full booking details with provider info
                const details = await fetchDetails();
                return res.json({
                    status: 'success',
                    payment_confirmed: true,
                    booking: details
                });
            }
            
            // Payment not confirmed yet
            return res.json({
                status: 'success',
                payment_confirmed: false,
                payku_status: paykuStatus,
                message: 'Pago aún en proceso.'
            });
            
        } catch (paykuErr) {
            logger.error(`[Verify] Payku API error for booking ${id}: ${paykuErr.message}`);
            return res.json({
                status: 'success',
                payment_confirmed: false,
                message: 'No se pudo verificar con Payku. El webhook procesará el pago automáticamente.'
            });
        }
        
    } catch (err) {
        next(err);
    }
};
