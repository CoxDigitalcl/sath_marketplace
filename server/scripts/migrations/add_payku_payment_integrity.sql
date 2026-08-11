-- Bind every Payku payment key to at most one booking and persist each verified
-- payment plus its deferred effects. Apply before deploying the hardened
-- handlers. This migration intentionally preserves all captured events on code
-- rollback.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE transaction_id IS NOT NULL
    GROUP BY transaction_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enable Payku payment integrity: duplicate bookings.transaction_id values must be reconciled first';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_payku_payment_key
  ON bookings (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  payment_key VARCHAR(255) NOT NULL,
  gateway_transaction_id VARCHAR(255) NOT NULL,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL CHECK (status = 'success'),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (currency = UPPER(currency)),
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_payment_webhook_provider_payment_key UNIQUE (provider, payment_key),
  CONSTRAINT uq_payment_webhook_provider_gateway_transaction UNIQUE (provider, gateway_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_booking
  ON payment_webhook_events (booking_id, processed_at DESC);

CREATE TABLE IF NOT EXISTS payment_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(96) NOT NULL,
  aggregate_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  deduplication_key VARCHAR(255) NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  last_error_code VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_outbox_pending
  ON payment_outbox (available_at, id)
  WHERE processed_at IS NULL;
