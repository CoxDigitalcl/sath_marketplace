import { pool } from '../config/db.js';
import logger from '../config/logger.js';

// Lazy migration: Ensure reviews table exists with service_id support
const ensureReviewsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER,
            service_id INTEGER,
            provider_id INTEGER NOT NULL,
            client_id INTEGER,
            reviewer_name VARCHAR(255),
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Add service_id column if it doesn't exist (for existing tables)
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'reviews' AND column_name = 'service_id'
            ) THEN
                ALTER TABLE reviews ADD COLUMN service_id INTEGER;
            END IF;
        END $$;
    `);
};

// GET /api/favorites
// Get all favorites for the current user
export const getFavorites = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Ensure reviews table exists
        await ensureReviewsTable();

        const query = `
            SELECT 
                f.id as favorite_id,
                f.service_id,
                f.created_at as favorited_at,
                s.title as name,
                s.price,
                s.image_urls,
                s.cover_image_url,
                s.is_active,
                pp.full_name as provider_name,
                pp.profile_image_url as provider_image,
                COALESCE(AVG(r.rating), 0) as rating
            FROM user_favorites f
            JOIN services s ON f.service_id = s.id
            JOIN provider_profiles pp ON s.provider_id = pp.user_id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE f.user_id = $1
            GROUP BY f.id, f.service_id, f.created_at, s.title, s.price, s.image_urls, s.cover_image_url, s.is_active, pp.full_name, pp.profile_image_url
            ORDER BY f.created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const favorites = result.rows.map(row => ({
            id: row.service_id,
            favoriteId: row.favorite_id,
            type: 'service',
            name: row.name,
            provider: row.provider_name,
            price: parseFloat(row.price) || 0,
            rating: parseFloat(row.rating) || 0,
            image: row.cover_image_url || row.image_urls?.[0] || row.provider_image || null,
            isAvailable: row.is_active,
            favoritedAt: row.favorited_at
        }));

        res.json({
            status: 'success',
            count: favorites.length,
            favorites
        });

    } catch (err) {
        logger.error(`Get Favorites Error: ${err.message}`);
        next(err);
    }
};

// POST /api/favorites
// Add a service to favorites
export const addFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { service_id } = req.body;

        if (!service_id) {
            return res.status(400).json({ status: 'error', message: 'service_id is required' });
        }

        // Check if service exists
        const serviceCheck = await pool.query('SELECT id FROM services WHERE id = $1', [service_id]);
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }

        // Check if already favorited
        const existingCheck = await pool.query(
            'SELECT id FROM user_favorites WHERE user_id = $1 AND service_id = $2',
            [userId, service_id]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ status: 'error', message: 'Service already in favorites' });
        }

        // Add to favorites
        const insertQuery = `
            INSERT INTO user_favorites (user_id, service_id)
            VALUES ($1, $2)
            RETURNING id, created_at
        `;

        const result = await pool.query(insertQuery, [userId, service_id]);

        res.status(201).json({
            status: 'success',
            message: 'Added to favorites',
            favorite: {
                id: result.rows[0].id,
                service_id,
                created_at: result.rows[0].created_at
            }
        });

    } catch (err) {
        logger.error(`Add Favorite Error: ${err.message}`);
        next(err);
    }
};

// DELETE /api/favorites/:serviceId
// Remove a service from favorites
export const removeFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { serviceId } = req.params;

        const deleteQuery = `
            DELETE FROM user_favorites 
            WHERE user_id = $1 AND service_id = $2
            RETURNING id
        `;

        const result = await pool.query(deleteQuery, [userId, serviceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Favorite not found' });
        }

        res.json({
            status: 'success',
            message: 'Removed from favorites'
        });

    } catch (err) {
        logger.error(`Remove Favorite Error: ${err.message}`);
        next(err);
    }
};

// GET /api/favorites/check/:serviceId
// Check if a service is in favorites
export const checkFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { serviceId } = req.params;

        const result = await pool.query(
            'SELECT id FROM user_favorites WHERE user_id = $1 AND service_id = $2',
            [userId, serviceId]
        );

        res.json({
            status: 'success',
            isFavorite: result.rows.length > 0
        });

    } catch (err) {
        logger.error(`Check Favorite Error: ${err.message}`);
        next(err);
    }
};
