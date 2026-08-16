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
    video_url VARCHAR(512),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
