import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { createInAppNotification, notifyAllAdmins } from './notificationController.js';

// =============================================================
// SUPPORT TICKETS CONTROLLER - Production Version
// Uses UUID, supports bidirectional messaging
// =============================================================

// GET /api/support/tickets
// Get all tickets for the current user (as creator or target)
export const getTickets = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Get tickets where user is creator OR target
        const query = `
            SELECT 
                st.*,
                u_creator.email as creator_email,
                u_target.email as target_email,
                (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = st.id) as message_count
            FROM support_tickets st
            LEFT JOIN users u_creator ON st.user_id = u_creator.id
            LEFT JOIN users u_target ON st.target_user_id = u_target.id
            WHERE st.user_id = $1 OR st.target_user_id = $1
            ORDER BY st.updated_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const tickets = result.rows.map(row => ({
            id: row.id,
            subject: row.subject,
            category: row.category,
            description: row.description,
            status: row.status,
            priority: row.priority,
            userRole: row.user_role,
            creatorEmail: row.creator_email,
            targetEmail: row.target_email,
            messageCount: parseInt(row.message_count) || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json({
            status: 'success',
            count: tickets.length,
            tickets
        });
    } catch (err) {
        logger.error(`Get Tickets Error: ${err.message}`);
        next(err);
    }
};

// POST /api/support/tickets
// Create a new support ticket
export const createTicket = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { subject, category, description, priority, targetUserId } = req.body;

        if (!subject || !category) {
            return res.status(400).json({
                status: 'error',
                message: 'subject and category are required'
            });
        }

        // Handle file upload
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/api/files/private/${req.file.filename}`;
        }

        const query = `
            INSERT INTO support_tickets 
            (user_id, user_role, target_user_id, subject, category, description, priority)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const result = await pool.query(query, [
            userId,
            userRole,
            targetUserId || null,
            subject,
            category,
            description || '',
            priority || 'Media'
        ]);

        const ticket = result.rows[0];

        // If there's an initial message (description), create first message
        if (description && description.trim()) {
            await pool.query(
                `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, attachment_url)
                 VALUES ($1, $2, $3, $4, $5)`,
                [ticket.id, userId, userRole, description, attachmentUrl]
            );
        }

        res.status(201).json({
            status: 'success',
            message: 'Ticket creado exitosamente',
            ticket: {
                id: ticket.id,
                subject: ticket.subject,
                status: ticket.status,
                createdAt: ticket.created_at
            }
        });

        // Notify admins about the new ticket
        notifyAllAdmins({
            title: 'Nuevo ticket de soporte',
            message: `${req.user.email} abrió un ticket: "${subject}" (${category})`,
            type: 'support',
            link: '/admin?view=tickets'
        });

    } catch (err) {
        logger.error(`Create Ticket Error: ${err.message}`);
        next(err);
    }
};

// GET /api/support/tickets/:ticketId
// Get single ticket with all messages
export const getTicketById = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { ticketId } = req.params;

        // Get ticket
        const ticketResult = await pool.query(
            `SELECT st.*, 
                    u_creator.email as creator_email,
                    u_target.email as target_email
             FROM support_tickets st
             LEFT JOIN users u_creator ON st.user_id = u_creator.id
             LEFT JOIN users u_target ON st.target_user_id = u_target.id
             WHERE st.id = $1 AND (st.user_id = $2 OR st.target_user_id = $2)`,
            [ticketId, userId]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket no encontrado'
            });
        }

        const ticket = ticketResult.rows[0];

        // Get messages
        const messagesResult = await pool.query(
            `SELECT tm.*, u.email as sender_email
             FROM ticket_messages tm
             JOIN users u ON tm.sender_id = u.id
             WHERE tm.ticket_id = $1
             ORDER BY tm.created_at ASC`,
            [ticketId]
        );

        res.json({
            status: 'success',
            ticket: {
                id: ticket.id,
                subject: ticket.subject,
                category: ticket.category,
                status: ticket.status,
                priority: ticket.priority,
                userRole: ticket.user_role,
                creatorEmail: ticket.creator_email,
                targetEmail: ticket.target_email,
                createdAt: ticket.created_at,
                updatedAt: ticket.updated_at
            },
            messages: messagesResult.rows.map(m => ({
                id: m.id,
                senderId: m.sender_id,
                senderEmail: m.sender_email,
                senderRole: m.sender_role,
                message: m.message,
                attachmentUrl: m.attachment_url,
                createdAt: m.created_at
            }))
        });

    } catch (err) {
        logger.error(`Get Ticket By ID Error: ${err.message}`);
        next(err);
    }
};

// POST /api/support/tickets/:ticketId/messages
// Add a message to a ticket
export const addMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { ticketId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'message is required'
            });
        }

        // Verify user has access to this ticket
        const ticketCheck = await pool.query(
            `SELECT id FROM support_tickets 
             WHERE id = $1 AND (user_id = $2 OR target_user_id = $2)`,
            [ticketId, userId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket no encontrado o sin acceso'
            });
        }

        // Handle file upload
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/api/files/private/${req.file.filename}`;
        }

        // Insert message
        const result = await pool.query(
            `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, attachment_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [ticketId, userId, userRole, message, attachmentUrl]
        );

        // Update ticket timestamp
        await pool.query(
            `UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [ticketId]
        );

        res.status(201).json({
            status: 'success',
            message: 'Mensaje enviado',
            data: {
                id: result.rows[0].id,
                message: result.rows[0].message,
                createdAt: result.rows[0].created_at
            }
        });

        // Notify the other party about the new message
        const ticketData = await pool.query(
            'SELECT user_id, subject FROM support_tickets WHERE id = $1',
            [ticketId]
        );
        if (ticketData.rows.length > 0) {
            const ticketOwner = ticketData.rows[0].user_id;
            // If an admin responds, notify the ticket owner; if user responds, notify admins
            if (userRole === 'admin' && ticketOwner !== userId) {
                createInAppNotification({
                    userId: ticketOwner,
                    title: 'Respuesta de soporte',
                    message: `Tienes una nueva respuesta en tu ticket: "${ticketData.rows[0].subject}"`,
                    type: 'info',
                    link: '/provider?view=support'
                });
            } else if (userRole !== 'admin') {
                notifyAllAdmins({
                    title: 'Nueva respuesta en ticket',
                    message: `${req.user.email} respondió al ticket: "${ticketData.rows[0].subject}"`,
                    type: 'support',
                    link: '/admin?view=tickets'
                });
            }
        }

    } catch (err) {
        logger.error(`Add Message Error: ${err.message}`);
        next(err);
    }
};

// PATCH /api/support/tickets/:ticketId/status
// Update ticket status
export const updateTicketStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { ticketId } = req.params;
        const { status } = req.body;

        const validStatuses = ['Abierto', 'En Proceso', 'Resuelto', 'Cerrado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: `Status inválido. Válidos: ${validStatuses.join(', ')}`
            });
        }

        // Only admin or ticket creator can change status
        const ticketCheck = await pool.query(
            `SELECT id, user_id FROM support_tickets WHERE id = $1`,
            [ticketId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket no encontrado'
            });
        }

        const ticket = ticketCheck.rows[0];
        if (userRole !== 'admin' && ticket.user_id !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permiso para cambiar el estado'
            });
        }

        await pool.query(
            `UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [status, ticketId]
        );

        res.json({
            status: 'success',
            message: `Ticket actualizado a ${status}`
        });

    } catch (err) {
        logger.error(`Update Ticket Status Error: ${err.message}`);
        next(err);
    }
};
