import express from 'express';
import {
    getClaims,
    createClaim,
    getBookingsForClaim,
    getClaimById,
    addClaimMessage
} from '../controllers/claimsController.js';
import { authenticateToken } from '../middleware/sessionAuth.js';
import upload from '../middleware/upload.js';
import { cleanupRejectedUploads, validateUploadedFileSignatures } from '../middleware/fileUploadSecurity.js';
import { privateAttachmentUploadLimiter } from '../middleware/uploadRateLimits.js';

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
router.post('/', privateAttachmentUploadLimiter, cleanupRejectedUploads, upload.single('attachment'), validateUploadedFileSignatures, createClaim);

// POST /api/claims/:claimId/messages - Add message to claim
router.post('/:claimId/messages', privateAttachmentUploadLimiter, cleanupRejectedUploads, upload.single('attachment'), validateUploadedFileSignatures, addClaimMessage);

export default router;
