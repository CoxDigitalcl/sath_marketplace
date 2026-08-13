import express from 'express';
import rateLimit from 'express-rate-limit';
import { createBooking, createGuestBooking, getBookings, handlePaykuWebhook, checkAvailability, updateBookingStatus, checkProviderAccess, getBookingById, getPublicBookingById, verifyPayment } from '../controllers/bookingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireBookingCapability } from '../services/bookingCapability.js';

const router = express.Router();

// Rate limiter for guest bookings (HIGH-01)
const guestBookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 guest bookings per IP per hour
    message: { status: 'error', message: 'Demasiados intentos de reserva. Intenta nuevamente más tarde.' }
});

const publicBookingReadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        code: 'BOOKING_READ_RATE_LIMITED',
        message: 'Demasiadas consultas de reserva. Intenta nuevamente más tarde.',
    },
});

// Public Routes (Webhook)
router.post('/webhook/payku', handlePaykuWebhook);

// Check Availability
router.get('/availability', checkAvailability);

// Payment Verification (public - works for both guests and authenticated users)
router.get('/verify/:id', publicBookingReadLimiter, requireBookingCapability, verifyPayment);

// Guest Checkout Routes
router.post('/guest', guestBookingLimiter, createGuestBooking);
router.get('/public/:id', publicBookingReadLimiter, requireBookingCapability, getPublicBookingById);

// Protected Routes
router.post('/', authenticateToken, createBooking);
router.get('/', authenticateToken, getBookings);
router.get('/provider/:providerId/has-access', authenticateToken, checkProviderAccess);
router.put('/:id/status', authenticateToken, updateBookingStatus);
router.get('/:id', authenticateToken, getBookingById);

export default router;
