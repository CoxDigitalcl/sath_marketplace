import express from 'express';
import { getBillingInfo, updateBillingInfo, getInvoices } from '../controllers/billingController.js';
import { authenticateToken } from '../middleware/sessionAuth.js';

const router = express.Router();

// All billing endpoints require authentication
router.use(authenticateToken);

// GET /api/billing - Get billing info
router.get('/', getBillingInfo);

// PUT /api/billing - Update billing info
router.put('/', updateBillingInfo);

// GET /api/billing/invoices - Get invoice history
router.get('/invoices', getInvoices);

export default router;
