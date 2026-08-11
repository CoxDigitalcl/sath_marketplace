-- Migration: Make provider_profiles columns nullable for progressive onboarding
-- Author: Antigravity
-- Date: 2026-01-22

-- 1. Modify provider_profiles to allow NULLs in profile fields
ALTER TABLE provider_profiles ALTER COLUMN rut DROP NOT NULL;
ALTER TABLE provider_profiles ALTER COLUMN bio DROP NOT NULL;
ALTER TABLE provider_profiles ALTER COLUMN coverage_area DROP NOT NULL;

-- 2. Ensure kyc_documents allows NULL or defaults to empty JSONB (already default in schema, but ensuring)
ALTER TABLE provider_profiles ALTER COLUMN kyc_documents SET DEFAULT '{}'::jsonb;

-- 3. Add notification configuration table (Optional, for admin email settings)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value) VALUES ('admin_email', 'admin@serviciosatuhogar.cl') ON CONFLICT DO NOTHING;
