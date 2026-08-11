import { pool } from '../config/db.js';

const checkSchema = async () => {
    try {
        console.log("Checking provider_profiles columns...");
        const res = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'provider_profiles';
        `);

        console.table(res.rows);

        const hasKyc = res.rows.some(r => r.column_name === 'kyc_documents');
        console.log("Has kyc_documents column?", hasKyc);

        if (!hasKyc) {
            console.log("!!! MISSING COLUMN DETECTED !!!");
            console.log("Attempting to add column...");
            try {
                // Try to add it if missing (might fail due to permissions, but worth a try with 'IF NOT EXISTS' logic if postgres supported it easily for columns, 
                // but ALTER TABLE ADD COLUMN IF NOT EXISTS is valid in PG 9.6+)
                await pool.query("ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '{}'::jsonb;");
                console.log("Column added successfully!");
            } catch (err) {
                console.error("Failed to add column:", err.message);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

checkSchema();
