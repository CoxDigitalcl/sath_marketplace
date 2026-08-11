export {
    checkAvailability,
    checkProviderAccess,
    createBooking,
    createGuestBooking,
    getBookingById,
    getBookings,
    getPublicBookingById,
    updateBookingStatus,
} from './bookingController.legacy.js';

export {
    handlePaykuWebhook,
    verifyPayment,
} from './paykuWebhookController.js';

import { startPaymentOutboxWorker } from './paykuWebhookController.js';

// Deployment order is explicit: apply add_payku_payment_integrity.sql first.
// Periodic retries remain opt-in so importing this module cannot emit invoices
// or notifications in local/test environments.
if (process.env.ENABLE_PAYMENT_OUTBOX_WORKER === 'true') {
    startPaymentOutboxWorker();
}
