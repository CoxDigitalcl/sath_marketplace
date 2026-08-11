import express from 'express';
import {
    getClaims,
    createClaim,
    getBookingsForClaim,
    getClaimById,
    addClaimMessage
} from '../controllers/claimsController.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All claims endpoints require authentication
router.use(authenticateToken);

// GET /api/claims - Get all claims for user
router.get('/', getClaims);

// GET /api/claims/bookings - Get bookings available for new claims
router.get('/bookings', getBookingsForClaim);

// GET /api/claims/:claimId - Get single claim with messages
router.get('/:claimId', getClaimById);

// POST /api/claims - Create new claim
router.post('/', upload.single('attachment'), createClaim);

// POST /api/claims/:claimId/messages - Add message to claim
router.post('/:claimId/messages', upload.single('attachment'), addClaimMessage);

export default router;
