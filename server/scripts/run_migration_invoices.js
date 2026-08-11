import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    try {
        console.log('🔌 Connecting to Database...');

        const sqlPath = path.join(__dirname, 'migration_invoicing.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`📄 Executing Migration from: ${sqlPath}`);
        console.log('------------------------------------------------');
        console.log(sql);
        console.log('------------------------------------------------');

        await pool.query(sql);

        console.log('✅ Migration Applied Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Failed:', error.message);
        process.exit(1);
    }
};

runMigration();
