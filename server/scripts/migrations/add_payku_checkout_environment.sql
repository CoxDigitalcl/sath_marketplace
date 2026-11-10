BEGIN;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payku_mode TEXT CHECK (payku_mode IN ('sandbox', 'production'));

CREATE TABLE IF NOT EXISTS payku_checkout_settings (
    singleton BOOLEAN PRIMARY KEY CHECK (singleton),
    mode TEXT NOT NULL CHECK (mode IN ('sandbox', 'production')),
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
