
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Manually configuring pool if dotenv fails or just to be safe using standard config
// Assuming default from project structure. If imports fail, we might need to adjust.
// Trying to import the existing db module first
const dbPath = path.join(__dirname, '../config/db.js');
let pool;

try {
    const dbModule = require(dbPath);
    pool = dbModule.pool || dbModule;
} catch (e) {
    console.log("Could not import db.js, creating new pool instance.");
    pool = new Pool({
        user: process.env.DB_USER || 'user_db',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'marketplace_db',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
    });
}

const initialCategories = [
    {
        id: 'hogar',
        name: 'Hogar y Mantención',
        commission: 15,
        subcategories: [
            "Limpieza profunda del hogar", "Limpieza de patios y bodegas", "Limpieza exterior ventanas", "Sello de cocinas y baños",
            "Limpieza campana/encimera/horno", "Limpieza de canaletas", "Mantención equipos A/C", "Mantención estufas a pellet",
            "Mantención calefont/calderas", "Gasfitería", "Electricidad", "Pintura", "Cerrajería"
        ]
    },
    {
        id: 'clases',
        name: 'Clases y Tutorías',
        commission: 12,
        subcategories: [
            "Matemáticas", "Inglés", "Lenguaje", "Química", "Física", "Alemán", "Piano", "Violín", "Guitarra",
            "Entrenamiento Fitness", "Defensa personal"
        ]
    },
    {
        id: 'salud',
        name: 'Salud y Bienestar',
        commission: 12,
        subcategories: [
            "Psicólogo", "Médico general", "Peluquería", "Enfermería", "Nutricionista", "Kinesiólogo", "Podología", "Manicure"
        ]
    },
    {
        id: 'eventos',
        name: 'Eventos y Entretenimiento',
        commission: 10,
        subcategories: [
            "Niñera por hora", "Decoración cumpleaños", "Payasos", "Mago", "Animación", "Juegos inflables", "Banquetera"
        ]
    },
    {
        id: 'automoviles',
        name: 'Automóviles',
        commission: 15,
        subcategories: [
            "Mecánica a domicilio", "Vulcanización", "Grúa", "Reemplazo baterías", "Lavado de autos", "Grabado de patentes", "Pulido de focos"
        ]
    },
    {
        id: 'fletes',
        name: 'Fletes y Mudanzas',
        commission: 15,
        subcategories: [
            "Fletes menores", "Mudanzas de casa", "Retiro de escombros", "Transporte de carga"
        ]
    },
    {
        id: 'colegio',
        name: 'Colegio',
        commission: 10,
        subcategories: [
            "Regalos escolares", "Charlas educativas", "Transporte escolar"
        ]
    }
];

const runMigration = async () => {
    try {
        console.log("Starting migration...");

        // 1. Create Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS service_categories (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                commission_percentage INTEGER NOT NULL DEFAULT 10,
                parent_id VARCHAR(100) REFERENCES service_categories(id) ON DELETE CASCADE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS platform_settings (
                key VARCHAR(255) PRIMARY KEY,
                value JSONB NOT NULL,
                group_name VARCHAR(100) NOT NULL,
                description TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tables created/verified.");

        // 2. Populate Categories
        for (const cat of initialCategories) {
            // Insert Main Category
            await pool.query(`
                INSERT INTO service_categories (id, name, commission_percentage, parent_id)
                VALUES ($1, $2, $3, NULL)
                ON CONFLICT (id) DO UPDATE 
                SET commission_percentage = EXCLUDED.commission_percentage, name = EXCLUDED.name;
            `, [cat.id, cat.name, cat.commission]);

            // Insert Subcategories
            for (const sub of cat.subcategories) {
                const subId = sub.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');

                // Using a made-up ID for subcategory based on name to keep it consistent
                await pool.query(`
                    INSERT INTO service_categories (id, name, commission_percentage, parent_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO NOTHING;
                `, [subId, sub, cat.commission, cat.id]);
            }
        }
        console.log("Categories populated.");

        console.log("Migration completed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
};

runMigration();
