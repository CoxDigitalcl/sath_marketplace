import { pool } from '../config/db.js';

async function migrate() {
    console.log('Starting moderation migration...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Add new columns to provider_profiles table
        await client.query(`
            ALTER TABLE provider_profiles 
            ADD COLUMN IF NOT EXISTS profile_image_status VARCHAR(20) DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS banner_image_status VARCHAR(20) DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS profile_image_rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS banner_image_rejection_reason TEXT;
        `);

        // We set existing images to 'approved' by default in the above query, 
        // but if they were already created with a 'pending' default from a previous migration,
        // we might leave them or set them to 'approved'. The previous migration did:
        // ADD COLUMN IF NOT EXISTS profile_image_status VARCHAR(20) DEFAULT 'pending';
        // Let's ensure banner is 'approved' for old ones as well.
        await client.query(`
            UPDATE provider_profiles 
            SET profile_image_status = 'approved' 
            WHERE profile_image_status = 'pending' OR profile_image_status IS NULL;
        `);

        await client.query(`
            UPDATE provider_profiles 
            SET banner_image_status = 'approved' 
            WHERE banner_image_status IS NULL;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
