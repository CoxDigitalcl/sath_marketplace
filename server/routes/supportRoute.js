import express from 'express';
import {
    getTickets,
    createTicket,
    getTicketById,
    addMessage,
    updateTicketStatus
} from '../controllers/supportController.js';
import { authenticateToken } from '../middleware/sessionAuth.js';
import upload from '../middleware/upload.js';
import { cleanupRejectedUploads, validateUploadedFileSignatures } from '../middleware/fileUploadSecurity.js';
import { privateAttachmentUploadLimiter } from '../middleware/uploadRateLimits.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// List all tickets for current user
router.get('/tickets', getTickets);

// Create new ticket
router.post('/tickets', privateAttachmentUploadLimiter, cleanupRejectedUploads, upload.single('file'), validateUploadedFileSignatures, createTicket);

// Get single ticket with messages
router.get('/tickets/:ticketId', getTicketById);

// Add message to ticket
router.post('/tickets/:ticketId/messages', privateAttachmentUploadLimiter, cleanupRejectedUploads, upload.single('file'), validateUploadedFileSignatures, addMessage);

// Update ticket status
router.patch('/tickets/:ticketId/status', updateTicketStatus);

export default router;
