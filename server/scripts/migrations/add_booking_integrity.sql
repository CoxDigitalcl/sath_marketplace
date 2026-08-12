BEGIN;

CREATE TABLE IF NOT EXISTS booking_idempotency (
    actor_scope VARCHAR(160) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    state VARCHAR(24) NOT NULL DEFAULT 'processing'
        CHECK (state IN ('processing', 'completed', 'failed')),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    http_status INTEGER,
    response_json JSONB,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_booking_idempotency_expires
    ON booking_idempotency (expires_at);

CREATE TABLE IF NOT EXISTS booking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    state VARCHAR(16) NOT NULL
        CHECK (state IN ('held', 'confirmed', 'released', 'cancelled')),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_slots_positive_range CHECK (ends_at > starts_at),
    CONSTRAINT booking_slots_hold_expiry CHECK (
        (state = 'held' AND hold_expires_at IS NOT NULL)
        OR (state <> 'held')
    ),
    CONSTRAINT booking_slots_booking_start_unique UNIQUE (booking_id, starts_at)
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_provider_window
    ON booking_slots (provider_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_booking_slots_active_holds
    ON booking_slots (hold_expires_at)
    WHERE state = 'held';

-- Historical paid bookings remain authoritative. Old pending-payment rows are
-- intentionally released because Payku does not expose a documented checkout
-- expiry contract and these pre-migration attempts are already stale.
INSERT INTO booking_slots (
    booking_id,
    service_id,
    provider_id,
    starts_at,
    ends_at,
    state,
    hold_expires_at
)
SELECT
    b.id,
    b.service_id,
    b.provider_id,
    ((b.scheduled_date AT TIME ZONE 'America/Santiago')::date + slot.time_text::time)
        AT TIME ZONE 'America/Santiago',
    (((b.scheduled_date AT TIME ZONE 'America/Santiago')::date + slot.time_text::time)
        AT TIME ZONE 'America/Santiago') + make_interval(mins => COALESCE(s.duration_minutes, 60)::int),
    CASE
        WHEN b.status IN ('in_escrow', 'service_completed', 'released', 'disputed') THEN 'confirmed'
        ELSE 'released'
    END,
    NULL
FROM bookings b
JOIN services s ON s.id = b.service_id
CROSS JOIN LATERAL (
    SELECT value AS time_text
    FROM jsonb_array_elements_text(
        CASE
            WHEN jsonb_typeof(b.selected_times) = 'array'
             AND jsonb_array_length(b.selected_times) > 0
            THEN b.selected_times
            ELSE jsonb_build_array(
                to_char(b.scheduled_date AT TIME ZONE 'America/Santiago', 'HH24:MI')
            )
        END
    )
) slot
WHERE b.status <> 'cancelled'
  AND b.scheduled_date IS NOT NULL
  AND slot.time_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
ON CONFLICT (booking_id, starts_at) DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_booking_slot_exclusion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.state = 'confirmed'
       OR (NEW.state = 'held' AND NEW.hold_expires_at > CURRENT_TIMESTAMP) THEN
        -- PostgreSQL 13 on the hosting account has no btree_gist. A
        -- transaction-scoped provider lock gives the same one-winner property.
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.provider_id::text, 19417));

        IF EXISTS (
            SELECT 1
            FROM booking_slots existing
            WHERE existing.provider_id = NEW.provider_id
              AND existing.id <> NEW.id
              AND (
                    existing.state = 'confirmed'
                    OR (
                        existing.state = 'held'
                        AND existing.hold_expires_at > CURRENT_TIMESTAMP
                    )
              )
              AND existing.starts_at < NEW.ends_at
              AND existing.ends_at > NEW.starts_at
        ) THEN
            RAISE EXCEPTION 'BOOKING_SLOT_CONFLICT'
                USING ERRCODE = '23P01',
                      DETAIL = 'The provider already has an active booking in this time range.';
        END IF;
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_slot_exclusion ON booking_slots;
CREATE TRIGGER trg_booking_slot_exclusion
BEFORE INSERT OR UPDATE OF provider_id, starts_at, ends_at, state, hold_expires_at
ON booking_slots
FOR EACH ROW
EXECUTE FUNCTION enforce_booking_slot_exclusion();

COMMIT;
