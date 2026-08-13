import express from 'express';
import { getPolicies } from '../controllers/policyController.js';

const router = express.Router();

// Publicly accessible? Or protected? 
// Usually policies are public, but for dashboard maybe just open or same auth.
// Let's keep it open or require auth if strict. For now, open is fine for text content, 
// but since it's nested in API, let's just leave it open or use Token if we want.
// Given the design, it's inside the dashboard, so let's stick to consistent Auth if possible, 
// BUT `ProviderLegal` might be viewed by unverified users? 
// Let's assume Authenticated for now as it's in the Dashboard route group.
import { authenticateToken } from '../middleware/sessionAuth.js';

router.get('/', authenticateToken, getPolicies);

export default router;
