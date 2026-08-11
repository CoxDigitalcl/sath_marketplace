-- Add structured service localization coverage.
-- Alternative A: provider-level coverage.

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS coverage_region_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS coverage_region_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS coverage_communes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_region_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS service_region_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS service_commune VARCHAR(120);

-- For large production tables, run these indexes during a maintenance window
-- or adapt them to CREATE INDEX CONCURRENTLY in a non-transactional migration runner.
CREATE INDEX IF NOT EXISTS idx_provider_profiles_coverage_region
  ON provider_profiles (coverage_region_code);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_coverage_communes
  ON provider_profiles USING GIN (coverage_communes);

CREATE INDEX IF NOT EXISTS idx_bookings_service_location
  ON bookings (service_region_code, service_commune);
