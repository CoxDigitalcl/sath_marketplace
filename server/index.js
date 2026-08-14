import 'dotenv/config'; // Load env vars before generic imports
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Note: In ESM, we must use extensions like .js
import logger from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/sessionAuth.js';
import securitySetup from './middleware/security.js';
import createRequestContextMiddleware from './middleware/requestContext.js';
import createHttpsRedirectMiddleware from './middleware/httpsRedirect.js';
import performanceLogger from './middleware/performanceLogger.js';
import createSeoFrontendRouter from './middleware/seoFrontend.js';
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
app.disable('x-powered-by');
// cPanel provides the PORT, but strictly default to 3001 if missing
const PORT = process.env.PORT || 3001;

// Trust the reverse proxy (cPanel/Nginx) for express-rate-limit and IP detection
app.set('trust proxy', 1);
app.use(createRequestContextMiddleware());

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
        logger.info('HTTP request', { method: req.method, path: req.path, correlationId: req.correlationId });
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

// 5. Serve Frontend through the single SEO-aware production router.
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '..', 'dist');
    app.use(createSeoFrontendRouter({ buildPath, db }));
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
