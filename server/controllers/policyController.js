import { pool } from '../config/db.js';
import logger from '../config/logger.js';

// Helper to ensure table exists and seed if empty
const ensureTableExists = async () => {
    const createQuery = `
    CREATE TABLE IF NOT EXISTS policies (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        target VARCHAR(50) DEFAULT 'global', -- global, provider, client
        version VARCHAR(20) DEFAULT '1.0',
        is_active BOOLEAN DEFAULT TRUE,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;
    await pool.query(createQuery);

    // Check if empty and seed
    const countRes = await pool.query('SELECT COUNT(*) FROM policies');
    if (parseInt(countRes.rows[0].count) === 0) {
        const seedQuery = `
            INSERT INTO policies (title, content, target, version) VALUES
            ('Términos y Condiciones de Uso', 'Bienvenido a Serviciosatuhogar. Al usar nuestra plataforma, aceptas estos términos...', 'global', '1.0'),
            ('Política de Privacidad', 'Nos tomamos muy en serio tu privacidad. Esta política describe cómo recopilamos y usamos tus datos...', 'global', '1.0'),
            ('Acuerdo de Nivel de Servicio (SLA)', 'Como proveedor, te comprometes a responder a las solicitudes en un plazo de 24 horas...', 'provider', '1.0');
        `;
        await pool.query(seedQuery);
        logger.info('Policies table seeded with default data');
    }
};

// GET /api/policies
// Query params: ?target=client|provider|global (optional)
export const getPolicies = async (req, res, next) => {
    try {
        await ensureTableExists(); // Ensure table exists and seeded

        const { target } = req.query;

        let query;
        let params = [];

        if (target === 'client') {
            // Show 'global' and 'client' policies
            query = "SELECT * FROM policies WHERE is_active = true AND target IN ('global', 'client') ORDER BY title ASC";
        } else if (target === 'provider') {
            // Show 'global' and 'provider' policies
            query = "SELECT * FROM policies WHERE is_active = true AND target IN ('global', 'provider') ORDER BY title ASC";
        } else {
            // Default: show all active policies
            query = "SELECT * FROM policies WHERE is_active = true ORDER BY title ASC";
        }

        const result = await pool.query(query, params);

        res.json({
            status: 'success',
            policies: result.rows.map(row => ({
                id: row.id,
                title: row.title,
                content: row.content,
                target: row.target,
                version: row.version,
                lastUpdated: row.last_updated
            }))
        });
    } catch (err) {
        logger.error(`Get Policies Error: ${err.message}`);
        next(err);
    }
};
