BEGIN;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id);

-- Preserve the publication state of all services that existed before moderation.
UPDATE services
SET moderation_status = 'approved'
WHERE moderation_status = 'pending'
  AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'services_moderation_status_check'
        AND conrelid = 'services'::regclass
  );

ALTER TABLE services
    DROP CONSTRAINT IF EXISTS services_moderation_status_check;

ALTER TABLE services
    ADD CONSTRAINT services_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_services_public_catalog
    ON services (is_active, moderation_status, created_at DESC);

COMMIT;
