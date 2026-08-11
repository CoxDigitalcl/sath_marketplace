
import { pool } from '../config/db.js';

async function addInvoiceColumns() {
    try {
        console.log('Adding invoice columns to bookings table...');

        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS invoice_url TEXT,
            ADD COLUMN IF NOT EXISTS invoice_folio VARCHAR(50),
            ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) DEFAULT 'pending';
        `);

        console.log('Columns added successfully.');
    } catch (err) {
        console.error('Error adding columns:', err);
    } finally {
        process.exit();
    }
}

addInvoiceColumns();
