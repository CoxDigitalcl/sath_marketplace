import 'dotenv/config'; // Load env vars before generic imports
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';

// Note: In ESM, we must use extensions like .js
import logger from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/auth.js';
import securitySetup from './middleware/security.js';
import performanceLogger from './middleware/performanceLogger.js';
import db from './config/db.js';
import authRoutes from './routes/authRoute.js';
import providerRoutes from './routes/providerRoute.js';
import serviceRoutes from './routes/serviceRoute.js';
import bookingRoutes from './routes/bookingRoute.js';
import adminRoutes from './routes/adminRoute.js';
import supportRoutes from './routes/supportRoute.js';
import policyRoutes from './routes/policyRoute.js';
import promotionRoutes from './routes/promotionRoute.js';
import publicProviderRoutes from './routes/publicProviderRoute.js';
import favoritesRoutes from './routes/favoritesRoute.js';
import claimsRoutes from './routes/claimsRoute.js';
import billingRoutes from './routes/billingRoute.js';
import publicRoutes from './routes/publicRoute.js';
import freightRoutes from './routes/freightRoute.js';
import notificationRoutes from './routes/notificationRoute.js';
import { getPrivateFile } from './controllers/privateFileController.js';
import axios from 'axios'; // For direct SimpleFactura API call

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// cPanel provides the PORT, but strictly default to 3001 if missing
const PORT = process.env.PORT || 3001;

const requireMaintenanceRoute = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
    }
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_MAINTENANCE_ROUTES === 'true') {
        return next();
    }
    return res.status(404).json({ status: 'error', message: 'Not found' });
};

// Trust the reverse proxy (cPanel/Nginx) for express-rate-limit and IP detection
app.set('trust proxy', 1);

// Force Restart Check
// 1. Basic Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Security
securitySetup(app);

// 2.1 Performance Monitoring
app.use(performanceLogger);

// 3. Request Logging (Console Only)
app.use((req, res, next) => {
    if (logger && logger.info) {
        logger.info(`${req.method} ${req.url} - ${req.ip}`);
    } else {
        console.log(`${req.method} ${req.url}`);
    }
    next();
});

// 4. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/providers', publicProviderRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/freight', freightRoutes);
app.get('/api/files/private/:filename', authenticateToken, getPrivateFile);

// Serve Uploads statically (protected? mostly public for now)
// Path: root/repositories/backend/uploads -> served at /uploads
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', (req, res, next) => {
    const filename = path.basename(req.path || '');
    if (/^(kyc_|attachment-|file-)/i.test(filename)) {
        return res.status(404).send('Not found');
    }
    return next();
}, express.static(uploadsPath));

app.get('/api/health', async (req, res) => {
    const healthData = {
        status: 'ok',
        timestamp: new Date()
    };

    try {
        await db.pool.query('SELECT 1');
        healthData.db_connection = 'connected';
        res.status(200).json(healthData);
    } catch {
        healthData.status = 'degraded';
        healthData.db_connection = 'disconnected';
        res.status(503).json(healthData);
    }
});

app.get('/api/test-db', authenticateToken, requireMaintenanceRoute, async (req, res, next) => {
    try {
        const start = Date.now();
        const result = await db.query('SELECT NOW() as current_time');
        const duration = Date.now() - start;

        res.json({
            status: 'success',
            message: 'Database Connection Established',
            latency_ms: duration,
            server_time: result.rows[0].current_time
        });
    } catch (err) {
        next(err);
    }
});

// SCHEMA SETUP ROUTE (Admin-only, behind JWT auth)
app.get('/api/setup-schema', authenticateToken, requireMaintenanceRoute, async (req, res) => {
    try {
        // 1. Run core schema
        const schemaPath = path.join(__dirname, 'scripts', 'schema.sql');
        if (!fs.existsSync(schemaPath)) return res.status(404).json({ error: 'Schema file missing' });

        const sql = fs.readFileSync(schemaPath, 'utf8');
        await db.query(sql);

        // 2. Create and Populate Categories
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_categories (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                commission_percentage INTEGER NOT NULL DEFAULT 10,
                parent_id VARCHAR(100) REFERENCES service_categories(id) ON DELETE CASCADE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                commission_type VARCHAR(20) DEFAULT 'PERCENTAGE',
                fixed_commission INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS platform_settings (
                key VARCHAR(255) PRIMARY KEY,
                value JSONB NOT NULL,
                group_name VARCHAR(100) NOT NULL,
                description TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

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

        for (const cat of initialCategories) {
            await db.query(`
                INSERT INTO service_categories (id, name, commission_percentage, parent_id)
                VALUES ($1, $2, $3, NULL)
                ON CONFLICT (id) DO UPDATE 
                SET commission_percentage = EXCLUDED.commission_percentage, name = EXCLUDED.name;
            `, [cat.id, cat.name, cat.commission]);

            for (const sub of cat.subcategories) {
                const subId = sub.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
                await db.query(`
                    INSERT INTO service_categories (id, name, commission_percentage, parent_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO NOTHING;
                `, [subId, sub, cat.commission, cat.id]);
            }
        }

        // 3. Create or expand verification_requirements and rejection_reasons tables and seed
        await db.query(`
            CREATE TABLE IF NOT EXISTS verification_requirements (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                file_type VARCHAR(50) DEFAULT 'document',
                accepted_formats TEXT DEFAULT '.pdf,.jpg,.jpeg,.png',
                max_file_size_mb INTEGER DEFAULT 10,
                expiration_required BOOLEAN DEFAULT FALSE,
                required_for_role VARCHAR(50) DEFAULT 'provider',
                is_mandatory BOOLEAN DEFAULT TRUE,
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS rejection_reasons (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                reason TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const seedDocs = [
            { id: 'kyc_id_front', name: 'Cédula de Identidad (Frente)', desc: 'Foto clara del anverso de tu cédula de identidad vigente.', fileType: 'image', formats: '.jpg,.jpeg,.png', order: 1 },
            { id: 'kyc_id_back', name: 'Cédula de Identidad (Dorso)', desc: 'Foto clara del reverso de tu cédula de identidad vigente.', fileType: 'image', formats: '.jpg,.jpeg,.png', order: 2 },
            { id: 'kyc_sii', name: 'Carpeta Tributaria (SII)', desc: 'Documento de Iniciación de Actividades o Carpeta Tributaria emitido por el SII.', fileType: 'document', formats: '.pdf,.jpg,.jpeg,.png', order: 3 },
            { id: 'kyc_address', name: 'Comprobante de Domicilio', desc: 'Cuenta de servicios básicos o certificado de domicilio con antigüedad máxima de 3 meses.', fileType: 'document', formats: '.pdf,.jpg,.jpeg,.png', order: 4 },
            { id: 'kyc_criminal_record', name: 'Certificado de Antecedentes', desc: 'Certificado de antecedentes penales emitido por el Registro Civil con antigüedad máxima de 30 días.', fileType: 'document', formats: '.pdf', order: 5, expiration: true }
        ];

        for (const doc of seedDocs) {
            await db.query(`
                INSERT INTO verification_requirements (id, name, description, file_type, accepted_formats, sort_order, expiration_required, required_for_role, is_mandatory, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'provider', TRUE, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    file_type = EXCLUDED.file_type,
                    accepted_formats = EXCLUDED.accepted_formats,
                    sort_order = EXCLUDED.sort_order,
                    expiration_required = EXCLUDED.expiration_required;
            `, [doc.id, doc.name, doc.desc, doc.fileType, doc.formats, doc.order, doc.expiration || false]);
        }

        const seedReasons = [
            'Documento borroso o ilegible',
            'Documento vencido',
            'Nombre no coincide con el perfil',
            'Archivo corrupto o formato no válido',
            'Falta reverso de la cédula',
            'Certificado con antigüedad mayor a 30 días'
        ];

        for (let i = 0; i < seedReasons.length; i++) {
            await db.query(`
                INSERT INTO rejection_reasons (reason, sort_order)
                SELECT $1, $2
                WHERE NOT EXISTS (SELECT 1 FROM rejection_reasons WHERE reason = $1);
            `, [seedReasons[i], i + 1]);
        }

        res.json({ 
            status: 'success', 
            message: 'Schema Applied, Categories populated, and KYC verification requirements seeded successfully.' 
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 5. Serve Frontend
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '..', 'dist');

    // Serve static assets
    app.use('/assets', express.static(path.join(buildPath, 'assets')));
    app.use(express.static(buildPath, { maxAge: '1y' }));

    // SSR Lite for Provider Profiles (OpenGraph Meta Tags)
    app.get('/provider/:id', async (req, res, next) => {
        try {
            const providerId = req.params.id;
            
            // Validate UUID manually if needed, otherwise query will fail gracefully
            if (!providerId || typeof providerId !== 'string') return next();

            try {
                // Fetch provider details strictly for Meta Tags
                const query = `
                    SELECT 
                        COALESCE(pp.full_name, pp.store_name, 'Proveedor') as name,
                        pp.bio,
                        pp.profile_image_url
                    FROM provider_profiles pp
                    WHERE pp.user_id = $1
                `;
                const result = await db.pool.query(query, [providerId]);
                
                let name = "Proveedor Servicios a tu Hogar";
                let bio = "Encuentra al mejor profesional en Servicios a tu Hogar.";
                let imageUrl = "https://serviciosatuhogar.cl/assets/logo.png";

                if (result.rows.length > 0) {
                    const p = result.rows[0];
                    name = `${p.name} | Servicios a tu Hogar`;
                    bio = p.bio ? (p.bio.substring(0, 150) + (p.bio.length > 150 ? '...' : '')) : bio;
                    if (p.profile_image_url) {
                        // Profile image URLs might be relative like "/uploads/xxx.jpg", prepend domain
                        imageUrl = p.profile_image_url.startsWith('http') ? p.profile_image_url : `https://serviciosatuhogar.cl${p.profile_image_url}`; 
                    }
                }

                const indexPath = path.join(buildPath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    let htmlData = fs.readFileSync(indexPath, 'utf8');
                    
                    // Inject OpenGraph Meta Tags
                    const metaTags = `
    <meta property="og:title" content="${name.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${bio.replace(/"/g, '&quot;').replace(/\n/g, ' ')}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="https://serviciosatuhogar.cl/provider/${providerId}" />
    <meta property="og:type" content="profile" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${name.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${bio.replace(/"/g, '&quot;').replace(/\n/g, ' ')}" />
    <meta name="twitter:image" content="${imageUrl}" />
</head>`;
                    
                    // Replace the closing </head> tag with our injected tags + closing tag
                    htmlData = htmlData.replace('</head>', metaTags);
                    return res.send(htmlData);
                } else {
                    return next(); 
                }
            } catch (dbErr) {
                // Ignore invalid UUID syntax errors from DB and fallback
                return next();
            }
        } catch (err) {
            console.error('[OpenGraph Injector Error]', err);
            return next(); 
        }
    });

    // SPA catch-all: Use regex for Express 5 compatibility
    app.get(/.*/, (req, res, next) => {
        // Skip API routes
        if (req.url.startsWith('/api')) return next();

        // Return 404 for missing static assets instead of serving index.html
        if (req.url.includes('.js') || req.url.includes('.css')) {
            return res.status(404).send('Asset not found');
        }

        res.sendFile(path.join(buildPath, 'index.html'), (err) => {
            if (err) {
                res.status(500).send("Error loading frontend");
            }
        });
    });
}

// 6. Error Handling
app.use(errorHandler);

// 7. Start Server
if (import.meta.url === `file://${process.argv[1]}`) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;
