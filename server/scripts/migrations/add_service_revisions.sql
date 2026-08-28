BEGIN;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS pricing_version BIGINT;

-- Normalize the current Service content contract for environments that were
-- created before these fields were moved out of runtime setup endpoints.
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS availability_type VARCHAR(20) DEFAULT 'agenda',
    ADD COLUMN IF NOT EXISTS calendar_config JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS categories_json JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(512),
    ADD COLUMN IF NOT EXISTS gallery_media JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'per_event',
    ADD COLUMN IF NOT EXISTS freight_base_price INTEGER,
    ADD COLUMN IF NOT EXISTS freight_price_per_km INTEGER,
    ADD COLUMN IF NOT EXISTS freight_max_distance_km INTEGER DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS is_staff_pick BOOLEAN DEFAULT FALSE;

UPDATE services
SET pricing_version = 1
WHERE pricing_version IS NULL OR pricing_version < 1;

ALTER TABLE services
    ALTER COLUMN pricing_version SET DEFAULT 1,
    ALTER COLUMN pricing_version SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'services_pricing_version_positive'
          AND conrelid = 'services'::regclass
    ) THEN
        ALTER TABLE services
            ADD CONSTRAINT services_pricing_version_positive
            CHECK (pricing_version > 0) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE services
    VALIDATE CONSTRAINT services_pricing_version_positive;

CREATE TABLE IF NOT EXISTS service_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revision_number BIGINT NOT NULL,
    revision_type VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    review_scope VARCHAR(16) NOT NULL,
    before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposed_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    auto_applied_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    pending_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    base_service_updated_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_revisions_number_positive CHECK (revision_number > 0),
    CONSTRAINT service_revisions_type_check
        CHECK (revision_type IN ('baseline', 'creation', 'update')),
    CONSTRAINT service_revisions_status_check
        CHECK (status IN (
            'applied',
            'pending',
            'approved',
            'correction_requested',
            'rejected',
            'superseded'
        )),
    CONSTRAINT service_revisions_scope_check
        CHECK (review_scope IN ('none', 'targeted', 'full')),
    CONSTRAINT service_revisions_before_object_check
        CHECK (jsonb_typeof(before_snapshot) = 'object'),
    CONSTRAINT service_revisions_proposed_object_check
        CHECK (jsonb_typeof(proposed_snapshot) = 'object'),
    CONSTRAINT service_revisions_reasons_array_check
        CHECK (jsonb_typeof(review_reasons) = 'array'),
    CONSTRAINT service_revisions_pending_scope_check
        CHECK (
            (
                status IN ('pending', 'correction_requested')
                AND review_scope IN ('targeted', 'full')
                AND cardinality(pending_fields) > 0
            )
            OR status NOT IN ('pending', 'correction_requested')
        ),
    CONSTRAINT service_revisions_applied_scope_check
        CHECK (
            status <> 'applied'
            OR (review_scope = 'none' AND cardinality(pending_fields) = 0)
        ),
    CONSTRAINT service_revisions_service_number_unique
        UNIQUE (service_id, revision_number),
    CONSTRAINT service_revisions_id_service_unique
        UNIQUE (id, service_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_revisions_one_current
    ON service_revisions (service_id)
    WHERE status IN ('pending', 'correction_requested');

CREATE INDEX IF NOT EXISTS idx_service_revisions_admin_queue
    ON service_revisions (status, created_at ASC)
    WHERE status IN ('pending', 'correction_requested');

CREATE INDEX IF NOT EXISTS idx_service_revisions_provider_history
    ON service_revisions (provider_id, service_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS service_revision_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL UNIQUE,
    service_id UUID NOT NULL,
    decision VARCHAR(24) NOT NULL,
    reason_code VARCHAR(80),
    comment TEXT,
    reviewed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    checklist_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_revision_decisions_value_check
        CHECK (decision IN ('approved', 'correction_requested', 'rejected')),
    CONSTRAINT service_revision_decisions_revision_service_fk
        FOREIGN KEY (revision_id, service_id)
        REFERENCES service_revisions(id, service_id)
        ON DELETE CASCADE,
    CONSTRAINT service_revision_decisions_reason_check
        CHECK (
            decision = 'approved'
            OR NULLIF(BTRIM(reason_code), '') IS NOT NULL
            OR NULLIF(BTRIM(comment), '') IS NOT NULL
        )
);

ALTER TABLE service_revision_decisions
    ADD COLUMN IF NOT EXISTS checklist_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_service_revision_decisions_service
    ON service_revision_decisions (service_id, created_at DESC);

-- Existing Services become immutable baselines. The subtraction keeps internal
-- identifiers and moderation metadata out of the content snapshot while still
-- preserving every content column present in each deployed schema.
INSERT INTO service_revisions (
    service_id,
    provider_id,
    revision_number,
    revision_type,
    status,
    review_scope,
    before_snapshot,
    proposed_snapshot,
    changed_fields,
    auto_applied_fields,
    pending_fields,
    review_reasons,
    base_service_updated_at,
    applied_at
)
SELECT
    s.id,
    s.provider_id,
    1,
    'baseline',
    'applied',
    'none',
    snapshot.content,
    snapshot.content,
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    '[]'::jsonb,
    s.updated_at,
    CURRENT_TIMESTAMP
FROM services s
CROSS JOIN LATERAL (
    SELECT to_jsonb(s)
        - ARRAY[
            'id',
            'provider_id',
            'is_active',
            'created_at',
            'updated_at',
            'pricing_version',
            'moderation_status',
            'moderation_reason',
            'moderated_at',
            'moderated_by'
        ]::TEXT[] AS content
) snapshot
WHERE NOT EXISTS (
    SELECT 1
    FROM service_revisions existing
    WHERE existing.service_id = s.id
)
ON CONFLICT (service_id, revision_number) DO NOTHING;

-- Legacy pending rows cannot be classified reliably as a new listing or a
-- previously published edit. They therefore receive a full update review that
-- preserves is_active on approval; only the new atomic creation path may
-- activate a Service automatically.
INSERT INTO service_revisions (
    service_id,
    provider_id,
    revision_number,
    revision_type,
    status,
    review_scope,
    before_snapshot,
    proposed_snapshot,
    changed_fields,
    auto_applied_fields,
    pending_fields,
    review_reasons,
    base_service_updated_at
)
SELECT
    s.id,
    s.provider_id,
    2,
    'update',
    'pending',
    'full',
    snapshot.content,
    snapshot.content,
    pending.fields,
    ARRAY[]::TEXT[],
    pending.fields,
    reasons.items,
    s.updated_at
FROM services s
CROSS JOIN LATERAL (
    SELECT to_jsonb(s)
        - ARRAY[
            'id',
            'provider_id',
            'is_active',
            'created_at',
            'updated_at',
            'pricing_version',
            'moderation_status',
            'moderation_reason',
            'moderated_at',
            'moderated_by'
        ]::TEXT[] AS content
) snapshot
CROSS JOIN LATERAL (
    SELECT ARRAY(
        SELECT field
        FROM unnest(ARRAY[
            'title',
            'description',
            'category',
            'price',
            'video_url',
            'duration_minutes',
            'type',
            'availability_type',
            'calendar_config',
            'features',
            'image_urls',
            'categories_json',
            'cover_image_url',
            'gallery_media',
            'pricing_type',
            'freight_base_price',
            'freight_price_per_km',
            'freight_max_distance_km'
        ]::TEXT[]) field
        WHERE snapshot.content ? field
    ) AS fields
) pending
CROSS JOIN LATERAL (
    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('field', field, 'code', 'LEGACY_PENDING_REVIEW')),
        '[]'::jsonb
    ) AS items
    FROM unnest(pending.fields) field
) reasons
WHERE s.moderation_status = 'pending'
  AND cardinality(pending.fields) > 0
  AND NOT EXISTS (
      SELECT 1
      FROM service_revisions current_revision
      WHERE current_revision.service_id = s.id
        AND current_revision.status IN ('pending', 'correction_requested')
  )
ON CONFLICT (service_id, revision_number) DO NOTHING;

COMMIT;
