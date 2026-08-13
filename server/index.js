import 'dotenv/config'; // Load env vars before generic imports
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Note: In ESM, we must use extensions like .js
import logger from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/auth.js';
import securitySetup from './middleware/security.js';
import createHttpsRedirectMiddleware from './middleware/httpsRedirect.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// cPanel provides the PORT, but strictly default to 3001 if missing
const PORT = process.env.PORT || 3001;

// Trust the reverse proxy (cPanel/Nginx) for express-rate-limit and IP detection
app.set('trust proxy', 1);

// Production must never serve credentials, bearer tokens or HTML over plaintext HTTP.
app.use(createHttpsRedirectMiddleware());

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
