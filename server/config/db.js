import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root or parent
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 5432,
    connectionTimeoutMillis: 5000,
});

import AlertService, { SEVERITY } from '../services/alertService.js';

// ...

pool.on('error', async (err, client) => {
    logger.error('Unexpected error on idle client', err);
    await AlertService.notify(err, { component: 'DB', event: 'IDLE_CLIENT_ERROR' }, SEVERITY.CRITICAL);
    process.exit(-1);
});

// Wrapped Query Function for Performance Monitoring
export const query = async (text, params) => {
    const start = process.hrtime();
    try {
        const result = await pool.query(text, params);

        // Calculate Duration
        const diff = process.hrtime(start);
        const duration = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

        // Slow Query Threshold: 100ms
        if (duration > 100) {
            // Trim query for log readability
            const cleanQuery = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : 'PreparedStatement';
            logger.warn(`[SLOW DB QUERY] ${duration}ms - ${cleanQuery.substring(0, 200)}...`);
        }

        return result;
    } catch (error) {
        throw error;
    }
};

export { pool };
export default { query, pool };
