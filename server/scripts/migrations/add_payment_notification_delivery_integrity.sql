-- Persist each payment-confirmation delivery independently so an outbox retry
-- can resume after a partial SMTP or in-app notification failure.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_client_email_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_provider_email_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_guest_email_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_provider_inapp_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_client_inapp_sent_at TIMESTAMP WITH TIME ZONE;

-- Preserve the previous coarse-grained idempotency contract for historical
-- bookings. A known sandbox partial delivery is reconciled explicitly after
-- deployment rather than encoded into this general migration.
UPDATE bookings
SET payment_client_email_sent_at = COALESCE(payment_client_email_sent_at, CURRENT_TIMESTAMP),
    payment_provider_email_sent_at = COALESCE(payment_provider_email_sent_at, CURRENT_TIMESTAMP),
    payment_guest_email_sent_at = COALESCE(payment_guest_email_sent_at, CURRENT_TIMESTAMP),
    payment_provider_inapp_sent_at = COALESCE(payment_provider_inapp_sent_at, CURRENT_TIMESTAMP),
    payment_client_inapp_sent_at = COALESCE(payment_client_inapp_sent_at, CURRENT_TIMESTAMP)
WHERE notifications_sent IS TRUE;
