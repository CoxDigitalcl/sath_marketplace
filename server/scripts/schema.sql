-- 1. USERS Table
-- Core authentication and role management
-- Changed uuid_generate_v4() to gen_random_uuid() (Native in Postgres 13+)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'provider', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
