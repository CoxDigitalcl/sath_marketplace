import express from 'express';
import {
    getTickets,
    createTicket,
    getTicketById,
    addMessage,
    updateTicketStatus
} from '../controllers/supportController.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// List all tickets for current user
router.get('/tickets', getTickets);

// Create new ticket
router.post('/tickets', upload.single('file'), createTicket);

// Get single ticket with messages
router.get('/tickets/:ticketId', getTicketById);

// Add message to ticket
router.post('/tickets/:ticketId/messages', upload.single('file'), addMessage);

// Update ticket status
router.patch('/tickets/:ticketId/status', updateTicketStatus);

export default router;
