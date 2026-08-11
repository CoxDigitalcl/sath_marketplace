-- Add Invoice and Settlement Columns to Bookings Table

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS invoice_url VARCHAR(512),
ADD COLUMN IF NOT EXISTS invoice_folio VARCHAR(50),
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) DEFAULT 'pending', -- pending, generated, failed
ADD COLUMN IF NOT EXISTS settlement_url VARCHAR(512),
ADD COLUMN IF NOT EXISTS settlement_folio VARCHAR(50),
ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) DEFAULT 'pending'; -- pending, generated, paid
