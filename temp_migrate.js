import { pool } from './server/config/db.js';

async function runMigration() {
    try {
        console.log('Starting moderation migration...');
        await pool.query(`
            ALTER TABLE provider_profiles 
            ADD COLUMN IF NOT EXISTS profile_image_status VARCHAR(20) DEFAULT 'pending';
        `);
        console.log('Column profile_image_status added.');

        await pool.query(`
            UPDATE provider_profiles 
            SET profile_image_status = 'approved' 
            WHERE profile_image_status IS NULL;
        `);
        console.log('Existing profiles defaulted to approved.');
    } catch (e) {
        console.error('Migration error:', e);
    } finally {
        process.exit(0);
    }
}

runMigration();
