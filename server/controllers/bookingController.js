export {
    checkProviderAccess,
    createBooking,
    createGuestBooking,
    getBookingById,
    getBookings,
    getPublicBookingById,
} from './bookingController.legacy.js';

export { checkAvailability } from './bookingAvailabilityController.js';
export { updateBookingStatus } from './bookingStatusController.js';

export {
    handlePaykuWebhook,
    verifyPayment,
} from './paykuWebhookController.js';

import { startPaymentOutboxWorker } from './paykuWebhookController.js';

// Deployment order is explicit: apply both integrity migrations first.
// Periodic retries remain opt-in so importing this module cannot emit invoices
// or notifications in local/test environments.
if (process.env.ENABLE_PAYMENT_OUTBOX_WORKER === 'true') {
    startPaymentOutboxWorker();
}
