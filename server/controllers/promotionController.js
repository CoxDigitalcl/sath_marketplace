import { pool } from '../config/db.js';
import logger from '../config/logger.js';

// Helper to ensure table exists (Lazy Migration)
const ensureTableExists = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        original_price INTEGER,
        discounted_price INTEGER,
        discount_label VARCHAR(50), 
        valid_until DATE,
        image_url VARCHAR(255),
        tag VARCHAR(50), 
        link_url VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;
    await pool.query(query);
};

// GET /api/promotions
export const getPromotions = async (req, res, next) => {
    try {
        await ensureTableExists(); // Auto-create table if missing

        const result = await pool.query(
            "SELECT * FROM promotions WHERE is_active = true ORDER BY created_at DESC"
        );

        res.json({
            status: 'success',
            promotions: result.rows
        });
    } catch (err) {
        logger.error(`Get Promotions Error: ${err.message}`);
        next(err);
    }
};
