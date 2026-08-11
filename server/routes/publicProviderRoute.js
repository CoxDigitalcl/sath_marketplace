import express from 'express';
import { getPublicProviderProfile, getAllProviders } from '../controllers/providerController.js';

import { checkCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public Routes
// Cache List for 10 min
router.get('/', checkCache(600), getAllProviders);
// Cache Profile for 5 min
router.get('/:id', checkCache(300), getPublicProviderProfile);

export default router;
