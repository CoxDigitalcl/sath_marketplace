
import { pool } from '../config/db.js';

async function checkUserSchema() {
    try {
        console.log('Checking users table schema...');
        const res = await pool.query("SELECT result FROM information_schema.columns WHERE table_name = 'users'");
        const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        console.log('User Columns:', columns.rows.map(r => r.column_name));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkUserSchema();
