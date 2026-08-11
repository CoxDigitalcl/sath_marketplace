import logger from '../config/logger.js';
import { createInAppNotification } from '../controllers/notificationController.js';
import {
    sendCrossContactEmails,
    sendGuestBookingConfirmation,
} from './notificationService.js';
import { getBookingPricingFromRow } from './commissionService.js';
import simpleFacturaService from './simpleFacturaService.js';

const terminalInvoiceStatuses = new Set([
    'generated',
    'skipped_disabled',
    'skipped_no_platform_fee',
]);

const codedError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

export const createPaymentConfirmationEffects = ({
    pool,
    log = logger,
    sendContacts = sendCrossContactEmails,
    sendGuestConfirmation = sendGuestBookingConfirmation,
    createNotification = createInAppNotification,
    invoiceService = simpleFacturaService,
} = {}) => {
    if (!pool?.query) {
        throw new TypeError('A PostgreSQL-compatible pool is required');
    }

    const sendNotifications = async ({ bookingId }) => {
        const result = await pool.query(
            `SELECT
                b.id,
                b.client_id,
                b.scheduled_date,
                b.selected_times,
                b.amount,
                b.guest_email,
                b.guest_name,
                b.guest_phone,
                b.notifications_sent,
                s.title AS service_title,
                COALESCE(c.email, b.guest_email) AS client_email,
                COALESCE(b.guest_name, c.full_name, c.email, b.guest_email) AS client_name,
                b.guest_phone AS client_phone,
                p.contact_email AS provider_email,
                p.public_phone AS provider_phone,
                p.full_name AS provider_name,
                b.provider_id
             FROM bookings b
             JOIN services s ON b.service_id = s.id
             LEFT JOIN users c ON b.client_id = c.id
             JOIN provider_profiles p ON b.provider_id = p.user_id
             WHERE b.id = $1`,
            [bookingId]
        );

        if (result.rows.length !== 1) {
            throw codedError('BOOKING_NOT_FOUND', 'Booking not found for payment notifications');
        }

        const row = result.rows[0];
        if (row.notifications_sent === true) {
            return { skipped: true };
        }
        if (!row.client_email || !row.provider_email) {
            throw codedError('NOTIFICATION_CONTACTS_MISSING', 'Payment notification contacts are incomplete');
        }

        const shortId = String(row.id).slice(0, 8).toUpperCase();
        const booking = {
            scheduled_date: row.scheduled_date,
            selected_times: row.selected_times,
            amount: row.amount,
        };
        const provider = {
            name: row.provider_name || 'Proveedor',
            email: row.provider_email,
            phone: row.provider_phone || 'No registrado',
        };

        await sendContacts({
            bookingId: shortId,
            serviceName: row.service_title,
            client: {
                name: row.client_name,
                email: row.client_email,
                phone: row.client_phone || 'No registrado',
            },
            provider,
            booking,
        });

        if (!row.client_id) {
            await sendGuestConfirmation({
                bookingId: shortId,
                serviceName: row.service_title,
                guest: {
                    name: row.guest_name || row.client_name,
                    email: row.guest_email || row.client_email,
                    phone: row.guest_phone || 'No registrado',
                },
                provider,
                booking,
            });
        }

        await createNotification({
            userId: row.provider_id,
            title: 'Nueva reserva confirmada',
            message: `${row.client_name} ha reservado y pagado "${row.service_title}".`,
            type: 'booking',
            link: '/provider?view=orders',
        });

        if (row.client_id) {
            await createNotification({
                userId: row.client_id,
                title: 'Pago confirmado',
                message: `Tu pago por "${row.service_title}" ha sido procesado.`,
                type: 'success',
                link: '/client?view=orders',
            });
        }

        await pool.query(
            `UPDATE bookings
             SET notifications_sent = TRUE
             WHERE id = $1
               AND notifications_sent IS DISTINCT FROM TRUE`,
            [bookingId]
        );

        log.info('[Payment Effects] Notifications completed', { bookingId });
        return { skipped: false };
    };

    const generateInvoice = async ({ bookingId }) => {
        const [settingsResult, bookingResult] = await Promise.all([
            pool.query(
                `SELECT key, value
                 FROM platform_settings
                 WHERE group_name = 'invoicing'`
            ),
            pool.query(
                `SELECT
                    b.id,
                    b.amount,
                    b.base_amount,
                    b.platform_fee,
                    b.commission_rate,
                    b.commission_type,
                    b.fixed_commission,
                    b.invoice_status,
                    sc.commission_percentage AS category_commission_percentage,
                    sc.commission_type AS category_commission_type,
                    sc.fixed_commission AS category_fixed_commission,
                    COALESCE(u.email, b.guest_email) AS client_email,
                    COALESCE(u.full_name, b.guest_name, u.email, b.guest_email) AS client_name,
                    s.title AS service_title
                 FROM bookings b
                 LEFT JOIN users u ON b.client_id = u.id
                 JOIN services s ON b.service_id = s.id
                 LEFT JOIN service_categories sc ON s.category = sc.id
                 WHERE b.id = $1`,
                [bookingId]
            ),
        ]);

        if (bookingResult.rows.length !== 1) {
            throw codedError('BOOKING_NOT_FOUND', 'Booking not found for payment invoice');
        }

        const booking = bookingResult.rows[0];
        if (terminalInvoiceStatuses.has(booking.invoice_status)) {
            return { skipped: true, status: booking.invoice_status };
        }

        const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value]));
        const invoicingEnabled = settings.simplefactura_status === true || settings.simplefactura_status === 'true';
        if (!invoicingEnabled) {
            await pool.query(
                `UPDATE bookings
                 SET invoice_status = 'skipped_disabled'
                 WHERE id = $1`,
                [bookingId]
            );
            return { skipped: true, status: 'skipped_disabled' };
        }

        if (!settings.simplefactura_username || !settings.simplefactura_password || !settings.simplefactura_rut_emisor) {
            throw codedError('INVOICE_CONFIGURATION_MISSING', 'SimpleFactura configuration is incomplete');
        }

        const pricing = getBookingPricingFromRow(booking);
        if (pricing.platformFee <= 0) {
            await pool.query(
                `UPDATE bookings
                 SET invoice_status = 'skipped_no_platform_fee'
                 WHERE id = $1`,
                [bookingId]
            );
            return { skipped: true, status: 'skipped_no_platform_fee' };
        }

        await pool.query(
            `UPDATE bookings
             SET invoice_status = 'processing'
             WHERE id = $1
               AND invoice_status IS DISTINCT FROM 'generated'`,
            [bookingId]
        );

        try {
            const invoiceResult = await invoiceService.generatePlatformFeeBoleta({
                username: settings.simplefactura_username,
                password: settings.simplefactura_password,
                rutEmisor: settings.simplefactura_rut_emisor,
                environment: settings.simplefactura_environment || 'sandbox',
            }, {
                id: booking.id,
                amount: pricing.platformFee,
                client: {
                    email: booking.client_email,
                    name: booking.client_name,
                    rut: 'Sin RUT',
                    address: 'Dirección cliente',
                    city: 'Santiago',
                },
                items: [{
                    name: `Tarifa de servicio plataforma - ${booking.service_title}`,
                    price: pricing.platformFee,
                }],
            });

            await pool.query(
                `UPDATE bookings
                 SET invoice_url = $1,
                     invoice_folio = $2,
                     invoice_status = 'generated'
                 WHERE id = $3`,
                [invoiceResult.data.url, invoiceResult.data.folio, bookingId]
            );
            log.info('[Payment Effects] Invoice completed', { bookingId });
            return { skipped: false, status: 'generated' };
        } catch (error) {
            await pool.query(
                `UPDATE bookings
                 SET invoice_status = 'failed'
                 WHERE id = $1`,
                [bookingId]
            );
            throw codedError(error?.code || 'DTE_UNAVAILABLE', 'Invoice provider failed');
        }
    };

    return {
        'payment.notifications.requested': sendNotifications,
        'payment.invoice.requested': generateInvoice,
    };
};

export default createPaymentConfirmationEffects;
