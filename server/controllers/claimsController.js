import { pool } from '../config/db.js';
import logger from '../config/logger.js';

// Ensure claims table exists (Lazy Migration)
const ensureClaimsTableExists = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_number VARCHAR(50) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id),
        booking_id UUID REFERENCES bookings(id),
        reason VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(10,2),
        status VARCHAR(30) DEFAULT 'Abierto',
        deadline TIMESTAMP WITH TIME ZONE,
        attachment_url VARCHAR(255),
        admin_notes TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_booking_id ON claims(booking_id);
    `;
    await pool.query(query);
};

// Generate claim number
const generateClaimNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CLM-${year}-${random}`;
};

// GET /api/claims
// Get all claims for current user
export const getClaims = async (req, res, next) => {
    try {
        await ensureClaimsTableExists();
        const userId = req.user.id;

        const query = `
            SELECT 
                c.*,
                b.id as booking_id,
                s.title as service_name,
                pp.full_name as provider_name
            FROM claims c
            LEFT JOIN bookings b ON c.booking_id = b.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN provider_profiles pp ON b.provider_id = pp.user_id
            WHERE c.user_id = $1
            ORDER BY c.created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const claims = result.rows.map(row => ({
            id: row.id,
            claimNumber: row.claim_number,
            bookingId: row.booking_id,
            serviceName: row.service_name || 'Servicio',
            providerName: row.provider_name || 'Proveedor',
            reason: row.reason,
            description: row.description,
            amount: parseFloat(row.amount) || 0,
            status: row.status,
            deadline: row.deadline,
            createdAt: row.created_at
        }));

        res.json({
            status: 'success',
            count: claims.length,
            claims
        });

    } catch (err) {
        logger.error(`Get Claims Error: ${err.message}`);
        next(err);
    }
};

// POST /api/claims
// Create a new claim
export const createClaim = async (req, res, next) => {
    try {
        await ensureClaimsTableExists();
        const userId = req.user.id;
        const { booking_id, reason, description, amount } = req.body;

        if (!booking_id || !reason || !description) {
            return res.status(400).json({
                status: 'error',
                message: 'booking_id, reason, and description are required'
            });
        }

        // Verify booking belongs to user
        const bookingCheck = await pool.query(
            'SELECT id, amount FROM bookings WHERE id = $1 AND client_id = $2',
            [booking_id, userId]
        );

        if (bookingCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Booking not found or does not belong to you'
            });
        }

        // Check for existing claim on this booking
        const existingClaim = await pool.query(
            'SELECT id FROM claims WHERE booking_id = $1 AND status != $2',
            [booking_id, 'Cerrado']
        );

        if (existingClaim.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe un reclamo activo para esta orden'
            });
        }

        const claimNumber = generateClaimNumber();
        // Set deadline to 10 business days from now
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 10);

        // Handle file upload
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/api/files/private/${req.file.filename}`;
        }

        const insertQuery = `
            INSERT INTO claims 
            (claim_number, user_id, booking_id, reason, description, amount, deadline, attachment_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const claimAmount = amount || bookingCheck.rows[0].amount;

        const result = await pool.query(insertQuery, [
            claimNumber,
            userId,
            booking_id,
            reason,
            description,
            claimAmount,
            deadline,
            attachmentUrl
        ]);

        res.status(201).json({
            status: 'success',
            message: 'Reclamo creado exitosamente',
            claim: {
                id: result.rows[0].id,
                claimNumber: result.rows[0].claim_number,
                status: result.rows[0].status,
                deadline: result.rows[0].deadline
            }
        });

    } catch (err) {
        logger.error(`Create Claim Error: ${err.message}`);
        next(err);
    }
};

// GET /api/claims/bookings
// Get bookings available for claims (confirmed bookings without active claims)
export const getBookingsForClaim = async (req, res, next) => {
    try {
        await ensureClaimsTableExists();
        const userId = req.user.id;

        const query = `
            SELECT 
                b.id,
                b.amount,
                b.created_at,
                s.title as service_name,
                pp.full_name as provider_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN provider_profiles pp ON b.provider_id = pp.user_id
            LEFT JOIN claims c ON b.id = c.booking_id AND c.status != 'Cerrado'
            WHERE b.client_id = $1 
              AND b.status IN ('in_escrow', 'service_completed', 'released', 'pending_payment')
              AND c.id IS NULL
            ORDER BY b.created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        res.json({
            status: 'success',
            bookings: result.rows.map(row => ({
                id: row.id,
                label: `${row.service_name} - ${row.provider_name}`,
                amount: parseFloat(row.amount),
                date: row.created_at
            }))
        });

    } catch (err) {
        logger.error(`Get Bookings for Claim Error: ${err.message}`);
        next(err);
    }
};

// GET /api/claims/:claimId
// Get single claim with all messages
export const getClaimById = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { claimId } = req.params;

        // Get claim - user must be owner or admin
        let claimQuery = `
            SELECT 
                c.*,
                s.title as service_name,
                pp.full_name as provider_name,
                u.email as client_email
            FROM claims c
            LEFT JOIN bookings b ON c.booking_id = b.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN provider_profiles pp ON b.provider_id = pp.user_id
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = $1
        `;

        const queryParams = [claimId];

        // Non-admins can only see their own claims
        if (userRole !== 'admin') {
            claimQuery += ` AND c.user_id = $2`;
            queryParams.push(userId);
        }

        const claimResult = await pool.query(claimQuery, queryParams);

        if (claimResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Reclamo no encontrado'
            });
        }

        const claim = claimResult.rows[0];

        // Get messages
        const messagesResult = await pool.query(
            `SELECT cm.*, u.email as sender_email
             FROM claim_messages cm
             JOIN users u ON cm.sender_id = u.id
             WHERE cm.claim_id = $1
             ORDER BY cm.created_at ASC`,
            [claimId]
        );

        res.json({
            status: 'success',
            claim: {
                id: claim.id,
                claimNumber: claim.claim_number,
                bookingId: claim.booking_id,
                serviceName: claim.service_name || 'Servicio',
                providerName: claim.provider_name || 'Proveedor',
                clientEmail: claim.client_email,
                reason: claim.reason,
                description: claim.description,
                amount: parseFloat(claim.amount) || 0,
                status: claim.status,
                resolution: claim.resolution,
                deadline: claim.deadline,
                createdAt: claim.created_at,
                updatedAt: claim.updated_at
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
        logger.error(`Get Claim By ID Error: ${err.message}`);
        next(err);
    }
};

// POST /api/claims/:claimId/messages
// Add a message to a claim
export const addClaimMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { claimId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'message is required'
            });
        }

        // Verify user has access (owner or admin)
        let accessQuery = `SELECT id, user_id, status FROM claims WHERE id = $1`;
        const accessParams = [claimId];

        if (userRole !== 'admin') {
            accessQuery += ` AND user_id = $2`;
            accessParams.push(userId);
        }

        const claimCheck = await pool.query(accessQuery, accessParams);

        if (claimCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Reclamo no encontrado o sin acceso'
            });
        }

        const claim = claimCheck.rows[0];

        // Don't allow messages on closed claims
        if (claim.status === 'Cerrado') {
            return res.status(400).json({
                status: 'error',
                message: 'No se pueden agregar mensajes a un reclamo cerrado'
            });
        }

        // Handle file upload
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/api/files/private/${req.file.filename}`;
        }

        // Insert message
        const result = await pool.query(
            `INSERT INTO claim_messages (claim_id, sender_id, sender_role, message, attachment_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [claimId, userId, userRole, message, attachmentUrl]
        );

        // Update claim timestamp and set to "En Revisión" if admin responds
        let newStatus = claim.status;
        if (userRole === 'admin' && claim.status === 'Abierto') {
            newStatus = 'En Revisión';
        }

        await pool.query(
            `UPDATE claims SET updated_at = CURRENT_TIMESTAMP, status = $1 WHERE id = $2`,
            [newStatus, claimId]
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

    } catch (err) {
        logger.error(`Add Claim Message Error: ${err.message}`);
        next(err);
    }
};
