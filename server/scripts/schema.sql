-- 1. USERS Table
-- Core authentication and role management
-- Changed uuid_generate_v4() to gen_random_uuid() (Native in Postgres 13+)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'provider', 'admin')),
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INTEGER NOT NULL DEFAULT 0,
    password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
    correlation_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION bump_user_token_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
       OR NEW.password_reset_required IS DISTINCT FROM OLD.password_reset_required THEN
        NEW.token_version := OLD.token_version + 1;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_security_version_trigger ON users;
CREATE TRIGGER users_security_version_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION bump_user_token_version();

-- 2. PROVIDER PROFILES Table
-- KYC and Public Profile Info
CREATE TABLE IF NOT EXISTS provider_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    rut VARCHAR(20) UNIQUE NOT NULL, -- Chilean Tax ID
    phone VARCHAR(20),
    bio TEXT,
    coverage_area VARCHAR(255),
    coverage_region_code VARCHAR(10),
    coverage_region_name VARCHAR(120),
    coverage_communes JSONB DEFAULT '[]'::jsonb,
    is_verified BOOLEAN DEFAULT FALSE,
    kyc_documents JSONB DEFAULT '{}'::jsonb, -- URLs to documents
    bank_data JSONB DEFAULT '{}'::jsonb,
    payouts_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SERVICES Table
-- Video-First Service Listings
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0), -- CLP
    pricing_version BIGINT NOT NULL DEFAULT 1
        CONSTRAINT services_pricing_version_positive CHECK (pricing_version > 0),
    video_url VARCHAR(512),
    is_active BOOLEAN DEFAULT TRUE,
    duration_minutes INTEGER DEFAULT 60,
    type VARCHAR(20) DEFAULT 'online',
    availability_type VARCHAR(20) DEFAULT 'agenda',
    calendar_config JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    image_urls JSONB DEFAULT '[]'::jsonb,
    categories_json JSONB DEFAULT '[]'::jsonb,
    cover_image_url VARCHAR(512),
    gallery_media JSONB DEFAULT '[]'::jsonb,
    pricing_type VARCHAR(20) DEFAULT 'per_event',
    freight_base_price INTEGER,
    freight_price_per_km INTEGER,
    freight_max_distance_km INTEGER DEFAULT 1000,
    is_staff_pick BOOLEAN DEFAULT FALSE,
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CONSTRAINT services_moderation_status_check CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    moderation_reason TEXT,
    moderated_at TIMESTAMPTZ,
    moderated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_service_revision_decisions_service
    ON service_revision_decisions (service_id, created_at DESC);

-- 4. BOOKINGS Table
-- Escrow Financial Logic
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- Denormalized for easier queries
    status VARCHAR(50) NOT NULL DEFAULT 'pending_payment' 
        CHECK (status IN ('pending_payment', 'in_escrow', 'service_completed', 'released', 'disputed', 'cancelled')),
    amount INTEGER NOT NULL CHECK (amount >= 0), -- Frozen price at time of booking
    transaction_id VARCHAR(255), -- External Payment Gateway ID
    scheduled_date TIMESTAMP WITH TIME ZONE,
    service_region_code VARCHAR(10),
    service_region_name VARCHAR(120),
    service_commune VARCHAR(120),
    
    -- Invoicing & Settlements
    invoice_url VARCHAR(512),
    invoice_folio VARCHAR(50),
    invoice_status VARCHAR(50) DEFAULT 'pending',

    -- Per-recipient checkpoints for retryable payment confirmation effects
    notifications_sent BOOLEAN DEFAULT FALSE,
    payment_client_email_sent_at TIMESTAMP WITH TIME ZONE,
    payment_provider_email_sent_at TIMESTAMP WITH TIME ZONE,
    payment_guest_email_sent_at TIMESTAMP WITH TIME ZONE,
    payment_provider_inapp_sent_at TIMESTAMP WITH TIME ZONE,
    payment_client_inapp_sent_at TIMESTAMP WITH TIME ZONE,

    settlement_url VARCHAR(512),
    settlement_folio VARCHAR(50),
    settlement_status VARCHAR(50) DEFAULT 'pending',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_coverage_region
    ON provider_profiles (coverage_region_code);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_coverage_communes
    ON provider_profiles USING GIN (coverage_communes);

CREATE INDEX IF NOT EXISTS idx_bookings_service_location
    ON bookings (service_region_code, service_commune);
