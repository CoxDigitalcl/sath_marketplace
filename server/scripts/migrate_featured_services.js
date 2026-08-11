
import { pool } from '../config/db.js';
import logger from '../config/logger.js';

const runMigration = async () => {
    try {
        console.log('Starting migration for Featured Services Refactor...');

        // 1. Add is_staff_pick to services if not exists
        console.log('Checking is_staff_pick column...');
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_staff_pick') THEN 
                    ALTER TABLE services ADD COLUMN is_staff_pick BOOLEAN DEFAULT FALSE; 
                    RAISE NOTICE 'Added is_staff_pick column';
                ELSE
                    RAISE NOTICE 'is_staff_pick column already exists';
                END IF; 
            END $$;
        `);

        // 2. Create service_promotions table
        console.log('Creating service_promotions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS service_promotions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                start_date TIMESTAMP WITH TIME ZONE NOT NULL,
                end_date TIMESTAMP WITH TIME ZONE NOT NULL,
                payment_status VARCHAR(20) CHECK (payment_status IN ('PAID', 'PENDING_DEDUCTION', 'EXPIRED', 'PENDING')),
                target_keywords TEXT[],
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Index for performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_promotions_service_id ON service_promotions(service_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_promotions_status ON service_promotions(payment_status);`);

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
