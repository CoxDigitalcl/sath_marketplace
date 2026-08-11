import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { createBooking, createGuestBooking, getBookings, handlePaykuWebhook, checkAvailability, updateBookingStatus, checkProviderAccess, getBookingById, getPublicBookingById, verifyPayment } from '../controllers/bookingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendEmail, sendGuestBookingConfirmation, sendCrossContactEmails } from '../services/notificationService.js';
import { pool } from '../config/db.js';

const router = express.Router();

// Rate limiter for guest bookings (HIGH-01)
const guestBookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 guest bookings per IP per hour
    message: { status: 'error', message: 'Demasiados intentos de reserva. Intenta nuevamente más tarde.' }
});

const requireMaintenanceMode = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_MAINTENANCE_ROUTES === 'true') {
        return next();
    }
    return res.status(404).json({ status: 'error', message: 'Not found' });
};

// Public Routes (Webhook)
router.post('/webhook/payku', handlePaykuWebhook);

// Check Availability
router.get('/availability', checkAvailability);

// Payment Verification (public - works for both guests and authenticated users)
router.get('/verify/:id', verifyPayment);

// Guest Checkout Routes
router.post('/guest', guestBookingLimiter, createGuestBooking);
router.get('/public/:id', getPublicBookingById);

// ==========================================
// FULL TRACE: Execute the ENTIRE notification flow
// and return every step's result as JSON.
// No log files needed — the response IS the log.
//
router.get('/trace-notifications/:bookingId', authenticateToken, requireMaintenanceMode, async (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
    }
    const trace = [];
    const log = (step, status, data = null) => {
        trace.push({ step, status, data, timestamp: new Date().toISOString() });
    };

    try {
        const { bookingId } = req.params;
        log('0_START', 'OK', { bookingId });

        // STEP 1: SMTP Configuration
        const smtpConfig = {
            SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
            SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
            SMTP_USER: process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 8) + '***' : 'NOT SET',
            SMTP_PASS: process.env.SMTP_PASS ? '***SET***' : 'NOT SET',
            MAIL_FROM: process.env.MAIL_FROM || 'NOT SET',
        };
        log('1_SMTP_CONFIG', process.env.SMTP_HOST ? 'OK' : 'FAIL', smtpConfig);

        // STEP 2: Direct SMTP connection test
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 465,
                secure: (parseInt(process.env.SMTP_PORT) || 465) === 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            await transporter.verify();
            log('2_SMTP_CONNECTION', 'OK', 'SMTP server responded successfully');
        } catch (smtpErr) {
            log('2_SMTP_CONNECTION', 'FAIL', { error: smtpErr.message, code: smtpErr.code });
        }

        // STEP 3: notifications_sent column check
        try {
            const colCheck = await pool.query('SELECT notifications_sent FROM bookings LIMIT 1');
            log('3_COLUMN_CHECK', 'OK', 'notifications_sent column EXISTS');
        } catch (colErr) {
            log('3_COLUMN_CHECK', 'FAIL', { error: colErr.message, hint: 'Column does not exist - this is OK with new code but was the bug before' });
        }

        // STEP 4: Fetch booking data
        let bookingData = null;
        try {
            const contactQuery = `
                SELECT 
                    b.id, b.status, b.client_id, b.scheduled_date, b.selected_times, b.amount,
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
                log('4_FETCH_BOOKING', 'FAIL', 'Booking NOT FOUND');
                return res.json({ trace });
            }
            
            bookingData = contactRes.rows[0];
            const isGuest = !bookingData.client_id;
            log('4_FETCH_BOOKING', 'OK', {
                id: bookingData.id,
                status: bookingData.status,
                is_guest: isGuest,
                client_id: bookingData.client_id,
                guest_email: bookingData.guest_email,
                guest_name: bookingData.guest_name,
                client_email: bookingData.client_email,
                client_name: bookingData.client_name,
                provider_email: bookingData.provider_email,
                provider_name: bookingData.provider_name,
                provider_phone: bookingData.provider_phone,
                scheduled_date: bookingData.scheduled_date,
                amount: bookingData.amount
            });
        } catch (dbErr) {
            log('4_FETCH_BOOKING', 'FAIL', { error: dbErr.message });
            return res.json({ trace });
        }

        const isGuest = !bookingData.client_id;
        const shortId = bookingData.id.slice(0, 8).toUpperCase();

        // STEP 5: Test sendEmail directly to guest/client
        const targetEmail = bookingData.guest_email || bookingData.client_email;
        log('5_TARGET_EMAIL', targetEmail ? 'OK' : 'FAIL', { targetEmail });

        if (targetEmail) {
            try {
                const directResult = await sendEmail({
                    to: targetEmail,
                    subject: `[TRACE TEST] Reserva #${shortId} - Serviciosatuhogar`,
                    html: `<div style="font-family: Arial; padding: 20px; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #16a34a;">✅ Trace Test - Email Directo</h2>
                        <p>Este email fue enviado directamente por el endpoint de traza.</p>
                        <p>Si recibes este email, <strong>sendEmail() funciona correctamente</strong> para tu dirección.</p>
                        <hr>
                        <p><strong>Booking:</strong> #${shortId}</p>
                        <p><strong>Servicio:</strong> ${bookingData.service_title}</p>
                        <p><strong>Proveedor:</strong> ${bookingData.provider_name} - ${bookingData.provider_email} - ${bookingData.provider_phone}</p>
                        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    </div>`
                });
                log('5_DIRECT_SEND_EMAIL', directResult ? 'OK' : 'FAIL', { 
                    sent_to: targetEmail, 
                    result: directResult,
                    note: directResult ? 'sendEmail returned TRUE' : 'sendEmail returned FALSE — check SMTP logs'
                });
            } catch (sendErr) {
                log('5_DIRECT_SEND_EMAIL', 'EXCEPTION', { error: sendErr.message, stack: sendErr.stack });
            }
        }

        // STEP 6: Test sendCrossContactEmails function
        log('6_CROSS_CONTACT_CHECK', typeof sendCrossContactEmails === 'function' ? 'OK' : 'FAIL', {
            type: typeof sendCrossContactEmails,
            is_function: typeof sendCrossContactEmails === 'function'
        });

        if (typeof sendCrossContactEmails === 'function') {
            try {
                await sendCrossContactEmails({
                    bookingId: shortId,
                    serviceName: bookingData.service_title,
                    client: {
                        name: bookingData.client_name,
                        email: bookingData.client_email,
                        phone: bookingData.client_phone || 'No registrado'
                    },
                    provider: {
                        name: bookingData.provider_name || 'Proveedor',
                        email: bookingData.provider_email,
                        phone: bookingData.provider_phone || 'No registrado'
                    },
                    booking: {
                        scheduled_date: bookingData.scheduled_date,
                        selected_times: bookingData.selected_times,
                        amount: bookingData.amount
                    }
                });
                log('6_CROSS_CONTACT_SEND', 'OK', 'sendCrossContactEmails completed without throwing');
            } catch (crossErr) {
                log('6_CROSS_CONTACT_SEND', 'EXCEPTION', { error: crossErr.message, stack: crossErr.stack });
            }
        }

        // STEP 7: Test sendGuestBookingConfirmation (only if guest)
        if (isGuest) {
            log('7_GUEST_CHECK', typeof sendGuestBookingConfirmation === 'function' ? 'OK' : 'FAIL', {
                type: typeof sendGuestBookingConfirmation,
                is_function: typeof sendGuestBookingConfirmation === 'function'
            });

            if (typeof sendGuestBookingConfirmation === 'function') {
                const guestEmail = bookingData.guest_email || bookingData.client_email;
                try {
                    await sendGuestBookingConfirmation({
                        bookingId: shortId,
                        serviceName: bookingData.service_title,
                        guest: {
                            name: bookingData.guest_name || bookingData.client_name,
                            email: guestEmail,
                            phone: bookingData.guest_phone || 'No registrado'
                        },
                        provider: {
                            name: bookingData.provider_name || 'Proveedor',
                            email: bookingData.provider_email,
                            phone: bookingData.provider_phone || 'No registrado'
                        },
                        booking: {
                            scheduled_date: bookingData.scheduled_date,
                            selected_times: bookingData.selected_times,
                            amount: bookingData.amount
                        }
                    });
                    log('7_GUEST_EMAIL_SEND', 'OK', `sendGuestBookingConfirmation completed. Target: ${guestEmail}`);
                } catch (guestErr) {
                    log('7_GUEST_EMAIL_SEND', 'EXCEPTION', { error: guestErr.message, stack: guestErr.stack });
                }
            }
        } else {
            log('7_GUEST_CHECK', 'SKIPPED', 'Not a guest booking (client_id is set)');
        }

        // STEP 8: Check the verify endpoint flow
        log('8_VERIFY_FLOW_CHECK', 'INFO', {
            booking_status: bookingData.status,
            is_paid: ['in_escrow', 'service_completed', 'released', 'disputed'].includes(bookingData.status),
            note: 'If is_paid=true, the verify endpoint should call sendBookingNotifications'
        });

        // FINAL: Summary
        const failures = trace.filter(t => t.status === 'FAIL' || t.status === 'EXCEPTION');
        log('9_SUMMARY', failures.length === 0 ? 'ALL_PASSED' : 'HAS_FAILURES', {
            total_steps: trace.length,
            failures: failures.length,
            failed_steps: failures.map(f => f.step)
        });

        res.json({ trace });
    } catch (err) {
        log('UNHANDLED_ERROR', 'FAIL', { error: err.message, stack: err.stack });
        res.json({ trace });
    }
});

// Protected Routes
router.post('/', authenticateToken, createBooking);
router.get('/', authenticateToken, getBookings);
router.get('/provider/:providerId/has-access', authenticateToken, checkProviderAccess);
router.put('/:id/status', authenticateToken, updateBookingStatus);
router.get('/:id', authenticateToken, getBookingById);

export default router;
