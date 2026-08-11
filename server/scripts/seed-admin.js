import { pool } from '../config/db.js';
import bcrypt from 'bcrypt';
import logger from '../config/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
    try {
        const email = process.argv[2] || 'admin@serviciosatuhogar.cl';
        const password = process.argv[3] || 'Admin123!';
        const name = 'Super Admin';

        console.log(`Loading Env Config...`);
        console.log(`DB Host: ${process.env.DB_HOST}`);
        console.log(`DB User: ${process.env.DB_USER}`);
        console.log(`DB Name: ${process.env.DB_DATABASE}`);

        if (!process.env.DB_HOST) {
            throw new Error('DB_HOST is missing. Check .env path.');
        }

        console.log(`Seeding Admin User: ${email}`);

        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Insert
        const res = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, created_at) 
             VALUES ($1, $2, $3, 'admin', NOW()) 
             ON CONFLICT (email) DO UPDATE 
             SET role = 'admin' 
             RETURNING id, email, role`,
            [name, email, hashedPassword]
        );

        console.log('✅ Admin User Created/Updated Successfully:');
        console.table(res.rows[0]);
        process.exit(0);

    } catch (err) {
        console.error('❌ Error creating admin:', err);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.hint) console.error('Hint:', err.hint);
        process.exit(1);
    }
};

createAdmin();
