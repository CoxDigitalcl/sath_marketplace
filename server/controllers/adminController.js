import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { getStats } from '../services/systemMetricService.js';
import { collectOperationalSnapshot } from '../services/operationalSnapshotService.js';
import { stats as getCacheStats } from '../services/cacheService.js';
import { getAlertStats } from '../services/alertService.js';
import { createInAppNotification } from './notificationController.js';
import { ensureBookingPricingColumns, getBookingPricingFromRow } from '../services/commissionService.js';

// GET /api/admin/system-stats
export const getSystemStats = async (req, res, next) => {
    try {
        const metrics = getStats();
        const operational = await collectOperationalSnapshot({ pool, cacheStats: getCacheStats });

        res.json({
            status: 'success',
            data: {
                ...metrics,
                database: operational.database.status,
                operational,
                alerts: getAlertStats(),
            },
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/stats
export const getAdminStats = async (req, res, next) => {
    try {
        const usersCount = await pool.query("SELECT COUNT(*) FROM users");
        const providersCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'provider'");
        const bookingsCount = await pool.query("SELECT COUNT(*) FROM bookings");
        // Revenue (sum of amount where status is paid or higher)
        const revenue = await pool.query("SELECT SUM(amount) FROM bookings WHERE status IN ('confirmed', 'completed')");

        res.json({
            status: 'success',
            data: {
                totalUsers: parseInt(usersCount.rows[0].count),
                totalProviders: parseInt(providersCount.rows[0].count),
                totalBookings: parseInt(bookingsCount.rows[0].count),
                totalRevenue: parseFloat(revenue.rows[0].sum || 0),
            }
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/users
export const getAllUsers = async (req, res, next) => {
    try {
        const result = await pool.query("SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 50");
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (err) {
        next(err);
    }
};
// GET /api/admin/providers
export const getProviders = async (req, res, next) => {
    try {
        // DEBUG: Check connection

        const query = `
            SELECT 
                u.id, 
                COALESCE(pp.store_name, pp.full_name) as "storeName", 
                pp.profile_image_url as "avatarUrl", 
                u.email as "ownerEmail", 
                CASE 
                    WHEN pp.is_verified THEN 'Activo' 
                    ELSE 'Pendiente' 
                END as "status",
                'General' as "mainCategory", 
                u.created_at as "registrationDate",
                0 as "income30d",
                0 as "orders30d",
                0 as "rating",
                0 as "cancellationRate",
                false as "payoutsEnabled"
            FROM users u
            LEFT JOIN provider_profiles pp ON u.id = pp.user_id
            WHERE u.role = 'provider'
            ORDER BY u.created_at DESC
        `;

        const result = await pool.query(query);
        console.log(`Admin: Found ${result.rows.length} providers.`);

        // Status is correctly calculated in SQL - pass through directly
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/clients
// GET /api/admin/clients
export const getClients = async (req, res, next) => {
    try {
        // Fetch clients with real aggregations
        const query = `
            SELECT
                u.id,
                COALESCE(u.full_name, u.email) as "nombre", -- Permanent Fix: Use real name, fallback to email if empty
                u.email,
                'Sin RUT' as "rut", -- Users table has no RUT column
                u.created_at as "registrationDate",
                
                -- Aggregations from Bookings
                COALESCE(b_stats.total_spent, 0) as "ltv",
                COALESCE(b_stats.total_orders, 0) as "totalOrders",
                
                -- Invoicing Info (Latest)
                b_latest.invoice_url as "last_invoice_url",
                
                -- Calculated Fields
                CASE 
                    WHEN COALESCE(b_stats.total_orders, 0) > 0 THEN 'Activo' 
                    ELSE 'Registrado' 
                END as "status",
                
                -- Placeholders/Defaults for now
                0 as "complaintRate",
                0 as "fraudScore",
                true as "isVerified",
                false as "hasSernacClaim"

            FROM users u
            LEFT JOIN (
                SELECT 
                    client_id, 
                    COUNT(*) as total_orders, 
                    SUM(amount) as total_spent
                FROM bookings 
                WHERE status IN ('completed', 'in_escrow', 'released')
                GROUP BY client_id
            ) b_stats ON u.id = b_stats.client_id
            LEFT JOIN LATERAL (
                SELECT invoice_url 
                FROM bookings 
                WHERE client_id = u.id AND invoice_url IS NOT NULL 
                ORDER BY created_at DESC 
                LIMIT 1
            ) b_latest ON true
            WHERE u.role = 'client'
            ORDER BY u.created_at DESC
        `;

        const result = await pool.query(query);

        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/clients/:id/profile
export const getClientProfile = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Get Client Orders (Bookings)
        const ordersQuery = `
            SELECT 
                b.id,
                b.amount,
                b.status,
                b.created_at as date,
                s.title as "serviceName",
                pp.full_name as "providerName"
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN provider_profiles pp ON b.provider_id = pp.user_id
            WHERE b.client_id = $1
            ORDER BY b.created_at DESC
        `;
        const ordersResult = await pool.query(ordersQuery, [id]);

        // 2. Get Sernac Claims
        const claimsQuery = `
            SELECT 
                id,
                claim_number,
                amount,
                status,
                created_at as date,
                deadline
            FROM claims
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;
        const claimsResult = await pool.query(claimsQuery, [id]);

        // 3. Payment Methods (Empty for now)
        const paymentMethods = [];

        // 4. Activity Log (Empty for now)
        const activityLog = [];

        res.json({
            status: 'success',
            data: {
                orders: ordersResult.rows || [],
                claims: claimsResult.rows.map(c => ({
                    id: c.claim_number, // The frontend expects the visible ID
                    amount: parseFloat(c.amount) || 0,
                    status: c.status,
                    date: c.date,
                    deadline: c.deadline
                })) || [],
                paymentMethods,
                activityLog
            }
        });

    } catch (err) {
        console.error('[ADMIN_CLIENT_PROFILE] Error:', err);
        next(err);
    }
};

// GET /api/admin/transactions
export const getTransactions = async (req, res, next) => {
    try {
        console.log("Admin getTransactions called"); // Debug Log
        await ensureBookingPricingColumns();
        const query = `
        SELECT
        b.id,
            b.amount,
            b.base_amount,
            b.platform_fee,
            b.commission_rate,
            b.commission_type,
            b.fixed_commission,
            b.status,
            b.transaction_id,
            b.created_at,
            b.updated_at,
            b.scheduled_date,

            --Client Info(Users table only has email)
        c.id as client_id,
            c.email as client_email,

            --Provider Info(Provider Profiles has full_name)
        p.id as provider_id,
            pp.full_name as provider_name,
            p.email as provider_email,

            --Service Info
        s.id as service_id,
            s.title as service_name,
            sc.commission_percentage as category_commission_percentage,
            sc.commission_type as category_commission_type,
            sc.fixed_commission as category_fixed_commission
            FROM bookings b
            LEFT JOIN users c ON b.client_id = c.id
            LEFT JOIN users p ON b.provider_id = p.id
            LEFT JOIN provider_profiles pp ON p.id = pp.user_id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            ORDER BY b.created_at DESC
        `;

        const result = await pool.query(query);

        const mappedOrders = result.rows.map(row => {
            const total_clp = parseInt(row.amount) || 0;
            const pricing = getBookingPricingFromRow(row);
            const platform_commission_rate = pricing.commissionRate;
            const platform_commission_clp = pricing.platformFee;
            const sii_retention_clp = 0; // Keeping 0 for now as per previous mock data pattern, or could be 19% if we handle tax withholding
            const provider_payout_clp = total_clp - platform_commission_clp - sii_retention_clp;

            // Status Mapping
            let status;
            let payout_status = 'NONE';
            let refund_status = 'NONE';

            // Map DB status to Frontend Enums
            switch (row.status) {
                case 'pending_payment': status = 'PENDING_PAYMENT'; break;
                case 'in_escrow': status = 'AUTHORIZED'; payout_status = 'PAYKU_SCHEDULED'; break; // Paid but held
                case 'service_completed': status = 'COMPLETED'; payout_status = 'PAYKU_PAID'; break; // Released
                case 'released': status = 'COMPLETED'; payout_status = 'PAYKU_PAID'; break;
                case 'cancelled': status = 'CANCELLED'; payout_status = 'NONE'; break;
                case 'disputed': status = 'DISPUTED'; payout_status = 'NONE'; break;
                default: status = 'PENDING_PAYMENT';
            }

            // Pseudo-random Order Number based on date/id if not present
            const dateYear = new Date(row.created_at).getFullYear();
            const order_number = `ORD - ${dateYear} -${row.id.substring(0, 8).toUpperCase()} `;

            return {
                id: row.id,
                order_number: order_number,
                customer_id: row.client_id,
                customer_name: row.client_email || 'Desconocido', // Use email as fallback
                provider_id: row.provider_id,
                provider_name: row.provider_name || row.provider_email || 'Desconocido',
                service_id: row.service_id,
                service_name: row.service_name || 'Servicio Eliminado',
                amount_clp: Math.round(total_clp / 1.19), // Net approximate
                iva_clp: total_clp - Math.round(total_clp / 1.19), // IVA approximate
                total_clp: total_clp,
                payku_transaction_id: row.transaction_id || `pay_${row.id.substring(0, 6)} `,
                payku_split_id: `split_${row.id.substring(0, 6)} `, // Mock for now
                platform_commission_rate,
                platform_commission_clp,
                sii_retention_clp,
                provider_payout_clp,
                status,
                raw_status: row.status,
                payout_status,
                refund_status,
                refund_amount_clp: 0,
                webhook_received_at: row.updated_at, // Use updated_at as proxy for webhook time
                created_at: row.created_at,
                completed_at: status === 'COMPLETED' ? row.updated_at : null,
                metadata: { device: 'Web' }
            };
        });

        res.json({
            status: 'success',
            data: mappedOrders
        });
    } catch (err) {
        next(err);
    }
};

// --- MODERATION ---
export const getModeration = async (req, res, next) => {
    try {
        // 1. Disputed Bookings
        const disputesQuery = `
            SELECT b.id, b.status, b.created_at, b.client_id, b.provider_id,
                   c.email as client_email, 
                   p.email as provider_email,
                   pp.full_name as provider_name
            FROM bookings b
            JOIN users c ON b.client_id = c.id
            JOIN users p ON b.provider_id = p.id
            LEFT JOIN provider_profiles pp ON b.provider_id = pp.user_id
            WHERE b.status = 'disputed'
        `;
        const disputesResult = await pool.query(disputesQuery);

        // 2. Pending Images (profile and banner images awaiting moderation)
        const imagesQuery = `
            SELECT 
                pp.user_id as id,
                COALESCE(pp.full_name, u.email) as "providerName",
                pp.profile_image_url as "imageUrl",
                'profile' as type,
                u.created_at as "uploadDate",
                'pending' as status
            FROM provider_profiles pp
            LEFT JOIN users u ON pp.user_id = u.id
            WHERE pp.profile_image_url IS NOT NULL 
              AND pp.profile_image_url != ''
              AND pp.profile_image_status = 'pending'
            UNION ALL
            SELECT 
                pp.user_id as id,
                COALESCE(pp.full_name, u.email) as "providerName",
                pp.banner_image_url as "imageUrl",
                'banner' as type,
                u.created_at as "uploadDate",
                'pending' as status
            FROM provider_profiles pp
            LEFT JOIN users u ON pp.user_id = u.id
            WHERE pp.banner_image_url IS NOT NULL 
              AND pp.banner_image_url != ''
              AND pp.banner_image_status = 'pending'
            LIMIT 40
        `;
        const imagesResult = await pool.query(imagesQuery);

        // 3. Reported Reviews (placeholder - requires reports table)
        // For now, return empty array
        const reviews = [];

        // 4. Reported Services (placeholder - requires reports table)
        // For now, return empty array
        const services = [];

        // Map disputes to expected format
        const disputes = disputesResult.rows.map(d => ({
            id: d.id,
            status: 'AWAITING_ADMIN',
            reason: `Disputa de reserva #${d.id}`,
            deadline: null,
            clientEmail: d.client_email,
            providerEmail: d.provider_email,
            providerName: d.provider_name
        }));

        // Map images to expected format
        const images = imagesResult.rows.map(img => ({
            id: img.id,
            providerName: img.providerName || 'Proveedor',
            imageUrl: img.imageUrl,
            type: img.type,
            uploadDate: img.uploadDate,
            status: 'Pendiente' // Match ImageModerationStatus.PENDING
        }));

        res.json({
            status: 'success',
            data: {
                disputes: disputes || [],
                images: images || [],
                reviews: reviews || [],
                services: services || []
            }
        });
    } catch (err) {
        console.error('[MODERATION] Error:', err);
        next(err);
    }
};

export const runModerationMigration = async (req, res, next) => {
    try {
        await pool.query(`
            ALTER TABLE provider_profiles 
            ADD COLUMN IF NOT EXISTS profile_image_status VARCHAR(20) DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS banner_image_status VARCHAR(20) DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS profile_image_rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS banner_image_rejection_reason TEXT;
        `);
        // Set existing 'pending' or NULL statuses to 'approved' to not flood dashboard
        await pool.query(`
            UPDATE provider_profiles 
            SET profile_image_status = 'approved' 
            WHERE profile_image_status = 'pending' OR profile_image_status IS NULL;
        `);
        await pool.query(`
            UPDATE provider_profiles 
            SET banner_image_status = 'approved' 
            WHERE banner_image_status IS NULL;
        `);

        res.json({ status: 'success', message: 'Moderation schema migration applied' });
    } catch (err) {
        console.error('[MODERATION_MIGRATION] Error:', err);
        next(err);
    }
};

export const resolveImageModeration = async (req, res, next) => {
    try {
        const { providerId } = req.params;
        const { status, reason, type } = req.body; // type should be 'profile' or 'banner'

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Invalid status' });
        }
        
        if (!['profile', 'banner'].includes(type)) {
            return res.status(400).json({ status: 'error', message: 'Invalid image type. Must be profile or banner.' });
        }

        const isProfile = type === 'profile';
        const statusColumn = isProfile ? 'profile_image_status' : 'banner_image_status';
        const urlColumn = isProfile ? 'profile_image_url' : 'banner_image_url';
        const reasonColumn = isProfile ? 'profile_image_rejection_reason' : 'banner_image_rejection_reason';

        const query = `
            UPDATE provider_profiles 
            SET ${statusColumn} = $1,
                ${reasonColumn} = $3
            WHERE user_id = $2
            RETURNING *;
        `;
        const result = await pool.query(query, [status, providerId, status === 'rejected' ? reason : null]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'error', message: 'Provider profile not found' });
        }

        if (status === 'rejected') {
            const updateImageQuery = `
                UPDATE provider_profiles
                SET ${urlColumn} = NULL
                WHERE user_id = $1
            `;
            await pool.query(updateImageQuery, [providerId]);
            console.log(`[MODERATION] ${type} image rejected for provider ${providerId}. Reason: ${reason}`);
        }

        // Notify the provider about the decision
        const imageLabel = type === 'profile' ? 'foto de perfil' : 'banner';
        if (status === 'approved') {
            createInAppNotification({
                userId: providerId,
                title: 'Imagen aprobada',
                message: `Tu ${imageLabel} ha sido aprobada y ya es visible al público.`,
                type: 'success',
                link: '/provider?view=profile'
            });
        } else {
            createInAppNotification({
                userId: providerId,
                title: 'Imagen rechazada',
                message: `Tu ${imageLabel} fue rechazada. Motivo: ${reason || 'No especificado'}. Por favor sube una nueva.`,
                type: 'error',
                link: '/provider?view=profile'
            });
        }

        res.json({ status: 'success', message: `${type} Image ${status}` });
    } catch (err) {
        console.error('[MODERATION_RESOLVE] Error:', err);
        next(err);
    }
};

// --- SUPPORT TICKETS (ADMIN) ---
// GET /api/admin/tickets - List all support tickets
export const getTickets = async (req, res, next) => {
    try {
        const { status, priority } = req.query;

        let query = `
            SELECT 
                st.*,
                u_creator.email as creator_email,
                u_target.email as target_email,
                (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = st.id) as message_count
            FROM support_tickets st
            LEFT JOIN users u_creator ON st.user_id = u_creator.id
            LEFT JOIN users u_target ON st.target_user_id = u_target.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND st.status = $${params.length}`;
        }
        if (priority) {
            params.push(priority);
            query += ` AND st.priority = $${params.length}`;
        }

        query += ` ORDER BY st.updated_at DESC`;

        const result = await pool.query(query, params);

        const tickets = result.rows.map(row => ({
            id: row.id,
            ticketNumber: `TK-${row.id.substring(0, 8).toUpperCase()}`,
            subject: row.subject,
            category: row.category,
            description: row.description,
            status: row.status,
            priority: row.priority,
            userRole: row.user_role,
            creatorEmail: row.creator_email,
            creatorName: row.creator_email,
            targetEmail: row.target_email,
            messageCount: parseInt(row.message_count) || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json({
            status: 'success',
            count: tickets.length,
            data: tickets
        });
    } catch (err) {
        if (err.code === '42P01') {
            return res.json({ status: 'success', count: 0, data: [] });
        }
        next(err);
    }
};

// POST /api/admin/tickets - Admin creates a ticket to a user
export const createTicket = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const { targetUserId, subject, category, priority, message } = req.body;

        if (!subject || !category) {
            return res.status(400).json({
                status: 'error',
                message: 'subject and category are required'
            });
        }

        // Verify target user exists if provided
        if (targetUserId) {
            const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Usuario destino no encontrado'
                });
            }
        }

        // Create ticket
        const ticketResult = await pool.query(`
            INSERT INTO support_tickets 
            (user_id, user_role, target_user_id, subject, category, priority)
            VALUES ($1, 'admin', $2, $3, $4, $5)
            RETURNING *
        `, [adminId, targetUserId || null, subject, category, priority || 'Media']);

        const ticket = ticketResult.rows[0];

        // Add initial message if provided
        if (message && message.trim()) {
            await pool.query(`
                INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message)
                VALUES ($1, $2, 'admin', $3)
            `, [ticket.id, adminId, message]);
        }

        res.status(201).json({
            status: 'success',
            message: 'Ticket creado exitosamente',
            data: {
                id: ticket.id,
                ticketNumber: `TK-${ticket.id.substring(0, 8).toUpperCase()}`,
                subject: ticket.subject,
                status: ticket.status,
                createdAt: ticket.created_at
            }
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/tickets/:ticketId - Get ticket detail with messages
export const getTicketDetail = async (req, res, next) => {
    try {
        const { ticketId } = req.params;

        // Get ticket
        const ticketResult = await pool.query(`
            SELECT st.*, 
                   u_creator.email as creator_email,
                   u_target.email as target_email
            FROM support_tickets st
            LEFT JOIN users u_creator ON st.user_id = u_creator.id
            LEFT JOIN users u_target ON st.target_user_id = u_target.id
            WHERE st.id = $1
        `, [ticketId]);

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket no encontrado'
            });
        }

        const ticket = ticketResult.rows[0];

        // Get messages
        const messagesResult = await pool.query(`
            SELECT tm.*, u.email as sender_email
            FROM ticket_messages tm
            JOIN users u ON tm.sender_id = u.id
            WHERE tm.ticket_id = $1
            ORDER BY tm.created_at ASC
        `, [ticketId]);

        res.json({
            status: 'success',
            ticket: {
                id: ticket.id,
                ticketNumber: `TK-${ticket.id.substring(0, 8).toUpperCase()}`,
                subject: ticket.subject,
                category: ticket.category,
                description: ticket.description,
                status: ticket.status,
                priority: ticket.priority,
                userRole: ticket.user_role,
                creatorEmail: ticket.creator_email,
                creatorName: ticket.creator_email,
                targetEmail: ticket.target_email,
                targetName: ticket.target_email,
                createdAt: ticket.created_at,
                updatedAt: ticket.updated_at
            },
            messages: messagesResult.rows.map(m => ({
                id: m.id,
                senderId: m.sender_id,
                senderEmail: m.sender_email,
                senderName: m.sender_email,
                senderRole: m.sender_role,
                message: m.message,
                attachmentUrl: m.attachment_url,
                createdAt: m.created_at
            }))
        });
    } catch (err) {
        next(err);
    }
};

// POST /api/admin/tickets/:ticketId/messages - Admin adds message
export const addTicketMessage = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const { ticketId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'message is required'
            });
        }

        // Verify ticket exists
        const ticketCheck = await pool.query('SELECT id FROM support_tickets WHERE id = $1', [ticketId]);
        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket no encontrado'
            });
        }

        // Insert message
        const result = await pool.query(`
            INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message)
            VALUES ($1, $2, 'admin', $3)
            RETURNING *
        `, [ticketId, adminId, message]);

        // Update ticket timestamp and status
        await pool.query(`
            UPDATE support_tickets 
            SET updated_at = CURRENT_TIMESTAMP, 
                status = CASE WHEN status = 'Abierto' THEN 'En Proceso' ELSE status END
            WHERE id = $1
        `, [ticketId]);

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
        next(err);
    }
};

// PATCH /api/admin/tickets/:ticketId/status - Update ticket status
export const updateTicketStatus = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;

        const validStatuses = ['Abierto', 'En Proceso', 'Resuelto', 'Cerrado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: `Status inválido. Válidos: ${validStatuses.join(', ')}`
            });
        }

        const result = await pool.query(`
            UPDATE support_tickets 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [status, ticketId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket no encontrado'
            });
        }

        res.json({
            status: 'success',
            message: `Ticket actualizado a ${status}`
        });
    } catch (err) {
        next(err);
    }
};

// --- CLAIMS MANAGEMENT (ADMIN) ---
// GET /api/admin/claims - List all claims (This comment was the last known line in view)

// ... (Simulate end of file append)

// --- DB MIGRATIONS (INDIRECT UPDATE) ---
// POST /api/admin/migrations/run-invoice-migration
export const runInvoiceMigration = async (req, res, next) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Add Columns to Bookings
            await client.query(`
                ALTER TABLE bookings 
                ADD COLUMN IF NOT EXISTS invoice_url VARCHAR(512),
                ADD COLUMN IF NOT EXISTS invoice_folio VARCHAR(50),
                ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) DEFAULT 'pending',
                ADD COLUMN IF NOT EXISTS settlement_url VARCHAR(512),
                ADD COLUMN IF NOT EXISTS settlement_folio VARCHAR(50),
                ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) DEFAULT 'pending';
            `);
            await client.query('COMMIT');
            res.json({ status: 'success', message: 'DB updated with Invoice Columns.' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
};
export const getAdminClaims = async (req, res, next) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT 
                c.*,
                u.email as client_email,
                s.title as service_name,
                pp.full_name as provider_name,
                (SELECT COUNT(*) FROM claim_messages cm WHERE cm.claim_id = c.id) as message_count
            FROM claims c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN bookings b ON c.booking_id = b.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN provider_profiles pp ON b.provider_id = pp.user_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND c.status = $${params.length}`;
        }

        query += ` ORDER BY c.created_at DESC`;

        const result = await pool.query(query, params);

        const claims = result.rows.map(row => ({
            id: row.id,
            claimNumber: row.claim_number,
            clientEmail: row.client_email,
            clientName: row.client_email,
            serviceName: row.service_name || 'Servicio',
            providerName: row.provider_name || 'Proveedor',
            reason: row.reason,
            amount: parseFloat(row.amount) || 0,
            status: row.status,
            resolution: row.resolution,
            deadline: row.deadline,
            messageCount: parseInt(row.message_count) || 0,
            createdAt: row.created_at
        }));

        res.json({
            status: 'success',
            count: claims.length,
            data: claims
        });
    } catch (err) {
        if (err.code === '42P01') {
            return res.json({ status: 'success', count: 0, data: [] });
        }
        next(err);
    }
};

// PATCH /api/admin/claims/:claimId/resolve - Resolve a claim
export const resolveClaim = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const { claimId } = req.params;
        const { resolution, message } = req.body;

        const validResolutions = ['client_favor', 'provider_favor'];
        if (!validResolutions.includes(resolution)) {
            return res.status(400).json({
                status: 'error',
                message: `Resolución inválida. Válidas: ${validResolutions.join(', ')}`
            });
        }

        // Update claim
        const result = await pool.query(`
            UPDATE claims 
            SET status = 'Resuelto', 
                resolution = $1, 
                resolved_by = $2, 
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [resolution, adminId, claimId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Reclamo no encontrado'
            });
        }

        // Add resolution message if provided
        if (message && message.trim()) {
            const resolutionText = resolution === 'client_favor'
                ? 'Resuelto a favor del cliente'
                : 'Resuelto a favor del proveedor';

            await pool.query(`
                INSERT INTO claim_messages (claim_id, sender_id, sender_role, message)
                VALUES ($1, $2, 'admin', $3)
            `, [claimId, adminId, `${resolutionText}. ${message}`]);
        }

        res.json({
            status: 'success',
            message: resolution === 'client_favor'
                ? 'Reclamo resuelto a favor del cliente'
                : 'Reclamo resuelto a favor del proveedor'
        });
    } catch (err) {
        next(err);
    }
};


// --- CATEGORIES MANAGEMENT ---
export const getCategories = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM service_categories ORDER BY created_at ASC';
        const result = await pool.query(query);
        const allCats = result.rows;

        const categoriesTree = allCats.filter(c => !c.parent_id).map(parent => {
            const children = allCats
                .filter(c => c.parent_id === parent.id)
                .map(child => child.name);

            return {
                id: parent.id,
                name: parent.name,
                commission: parent.commission_percentage,
                commissionType: parent.commission_type || 'PERCENTAGE',
                fixedCommission: parent.fixed_commission || 0,
                status: parent.is_active ? 'active' : 'inactive',
                subcategories: children
            };
        });

        res.json({ status: 'success', data: categoriesTree });
    } catch (err) {
        if (err.code === '42P01') return res.json({ status: 'success', data: [] });
        next(err);
    }
};

export const createCategory = async (req, res, next) => {
    try {
        const { id, name, commission, commissionType, fixedCommission, parentId } = req.body;
        const catId = id || name.toLowerCase().replace(/ /g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const query = `
            INSERT INTO service_categories(id, name, commission_percentage, commission_type, fixed_commission, parent_id)
        VALUES($1, $2, $3, $4, $5, $6)
            ON CONFLICT(id) DO NOTHING
        RETURNING *
            `;
        const values = [catId, name, commission ?? 10, commissionType || 'PERCENTAGE', fixedCommission ?? 0, parentId || null];
        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(409).json({ status: 'error', message: 'Category ID already exists' });
        }
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

export const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, commission, commissionType, fixedCommission, status } = req.body;

        const query = `
            UPDATE service_categories 
            SET name = COALESCE($1, name),
            commission_percentage = COALESCE($2, commission_percentage),
            commission_type = COALESCE($3, commission_type),
            fixed_commission = COALESCE($4, fixed_commission),
            is_active = COALESCE($5, is_active)
            WHERE id = $6
        RETURNING *
            `;
        let isActive = undefined;
        if (status) isActive = status === 'active';

        const result = await pool.query(query, [name, commission, commissionType, fixedCommission, isActive, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'error', message: 'Category not found' });
        }
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

export const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM service_categories WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ status: 'error', message: 'Category not found' });
        }
        res.json({ status: 'success', message: 'Category deleted' });
    } catch (err) {
        next(err);
    }
};

// --- PLATFORM SETTINGS MANAGEMENT ---
// --- PLATFORM SETTINGS MANAGEMENT ---
export const getSettings = async (req, res, next) => {
    try {
        const { group } = req.params;
        let query = 'SELECT * FROM platform_settings';
        let params = [];
        if (group && group !== 'all') {
            query += ' WHERE group_name = $1';
            params.push(group);
        }
        const result = await pool.query(query, params);
        const settingsMap = {};
        console.log(`[Settings] Fetched ${result.rowCount} rows for group: ${group}`);

        result.rows.forEach(row => {
            // Mask sensitive password fields
            let val = row.value;
            // The pg library usually parses JSONB automatically. 
            // If we JSON.stringify on save, 'val' here might be the actual primitive (string/bool) 
            // OR if we double-encoded, a string.
            // Let's assume standard behavior: pg returns the parsed JSON object/primitive.

            if (row.key.includes('password') && val) {
                settingsMap[row.key] = '********';
            } else {
                settingsMap[row.key] = val;
            }
        });
        res.json({ status: 'success', data: settingsMap });
    } catch (err) {
        if (err.code === '42P01') {
            console.warn('[Settings] Table platform_settings not found!');
            return res.json({ status: 'success', data: {} });
        }
        next(err);
    }
};

export const updateSettings = async (req, res, next) => {
    try {
        const { settings, group } = req.body;
        console.log(`[Settings] Updating group: ${group}`, Object.keys(settings));

        const keys = Object.keys(settings);
        const promises = keys.map(key => {
            const value = settings[key];
            // Ensure value is stringified if it's an object/array, though currently they seem to be strings/bools.
            // But the DB column is JSONB. So we should pass the value directly if pg handles it, 
            // OR JSON.stringify it if we want to store it as a JSON string inside JSONB.
            // Wait, previous code was: VALUES($1, $2, $3) with [key, value, group].
            // If value is a string "foo", passing it to JSONB column works in PG (it becomes "foo").

            return pool.query(`
                INSERT INTO platform_settings(key, value, group_name)
                VALUES($1, $2, $3)
                ON CONFLICT(key) 
                DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
            `, [key, JSON.stringify(value), group || 'general']);
            // ALERT: We were passing `value` directly. If `value` is a raw string "user", 
            // Postgres JSONB might expect verified JSON. 
            // It's safer to ALWAYS JSON.stringify(value) before inserting into a JSONB column 
            // so strings are stored as "string", numbers as 123, etc.
            // This might be the cause! "invalid input syntax for type json"
        });
        await Promise.all(promises);
        console.log('[Settings] Update successful');
        res.json({ status: 'success', message: 'Settings updated' });
    } catch (err) {
        console.error('[Settings] Update Error:', err);
        next(err);
    }
};

// --- POLICY MANAGEMENT ---
export const getPolicies = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM legal_policies ORDER BY updated_at DESC';
        const result = await pool.query(query);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        if (err.code === '42P01') return res.json({ status: 'success', data: [] });
        next(err);
    }
};

export const upsertPolicy = async (req, res, next) => {
    try {
        const { id, title, content, target, isActive } = req.body;

        const query = `
            INSERT INTO legal_policies(id, title, content, target_role, is_active, updated_at)
        VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT(id) 
            DO UPDATE SET
        title = EXCLUDED.title,
            content = EXCLUDED.content,
            target_role = EXCLUDED.target_role,
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
            `;

        const result = await pool.query(query, [id, title, content, target, isActive]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

export const deletePolicy = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM legal_policies WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) return res.status(404).json({ status: 'error', message: 'Policy not found' });

        res.json({ status: 'success', message: 'Policy deleted' });
    } catch (err) {
        next(err);
    }
};

// --- VERIFICATION SETTINGS MANAGEMENT ---
export const getVerificationRequirements = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM verification_requirements ORDER BY sort_order ASC, name ASC';
        const result = await pool.query(query);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        // Table doesn't exist
        if (err.code === '42P01') return res.json({ status: 'success', data: [] });
        // Column doesn't exist (sort_order not yet migrated) — fallback to basic query
        if (err.code === '42703') {
            try {
                const fallback = await pool.query('SELECT * FROM verification_requirements ORDER BY name ASC');
                return res.json({ status: 'success', data: fallback.rows });
            } catch (e) {
                return res.json({ status: 'success', data: [] });
            }
        }
        next(err);
    }
};

export const upsertVerificationRequirement = async (req, res, next) => {
    try {
        const { id, name, description, role, isMandatory, isActive, fileType, acceptedFormats, maxFileSize, expirationRequired, sortOrder } = req.body;

        // Sanitize ID: prefix with kyc_ if not present
        let cleanId = id.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        if (!cleanId.startsWith('kyc_')) cleanId = 'kyc_' + cleanId;

        const query = `
            INSERT INTO verification_requirements(id, name, description, required_for_role, is_mandatory, is_active, file_type, accepted_formats, max_file_size_mb, expiration_required, sort_order)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT(id) 
            DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                required_for_role = EXCLUDED.required_for_role,
                is_mandatory = EXCLUDED.is_mandatory,
                is_active = EXCLUDED.is_active,
                file_type = EXCLUDED.file_type,
                accepted_formats = EXCLUDED.accepted_formats,
                max_file_size_mb = EXCLUDED.max_file_size_mb,
                expiration_required = EXCLUDED.expiration_required,
                sort_order = EXCLUDED.sort_order,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pool.query(query, [
            cleanId, name, description || null,
            role || 'provider', isMandatory !== false, isActive !== false,
            fileType || 'document', acceptedFormats || '.pdf,.jpg,.jpeg,.png',
            maxFileSize || 10, expirationRequired || false, sortOrder || 0
        ]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

export const deleteVerificationRequirement = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM verification_requirements WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) return res.status(404).json({ status: 'error', message: 'Requirement not found' });

        res.json({ status: 'success', message: 'Requirement deleted' });
    } catch (err) {
        next(err);
    }
};

// --- KYC MIGRATION: Create/expand tables + Seed ---
export const runKycMigration = async (req, res, next) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create or expand verification_requirements table
            await client.query(`
                CREATE TABLE IF NOT EXISTS verification_requirements (
                    id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    file_type VARCHAR(50) DEFAULT 'document',
                    accepted_formats TEXT DEFAULT '.pdf,.jpg,.jpeg,.png',
                    max_file_size_mb INTEGER DEFAULT 10,
                    expiration_required BOOLEAN DEFAULT FALSE,
                    required_for_role VARCHAR(50) DEFAULT 'provider',
                    is_mandatory BOOLEAN DEFAULT TRUE,
                    is_active BOOLEAN DEFAULT TRUE,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Add new columns if table already existed
            const addCols = [
                "ADD COLUMN IF NOT EXISTS file_type VARCHAR(50) DEFAULT 'document'",
                "ADD COLUMN IF NOT EXISTS accepted_formats TEXT DEFAULT '.pdf,.jpg,.jpeg,.png'",
                "ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10",
                "ADD COLUMN IF NOT EXISTS expiration_required BOOLEAN DEFAULT FALSE",
                "ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
                "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ];
            for (const col of addCols) {
                await client.query(`ALTER TABLE verification_requirements ${col}`);
            }

            // 2. Seed 5 default KYC document types (if not exist)
            const seedDocs = [
                { id: 'kyc_id_front', name: 'Cédula de Identidad (Frente)', desc: 'Foto clara del anverso de tu cédula de identidad vigente.', fileType: 'image', formats: '.jpg,.jpeg,.png', order: 1 },
                { id: 'kyc_id_back', name: 'Cédula de Identidad (Dorso)', desc: 'Foto clara del reverso de tu cédula de identidad vigente.', fileType: 'image', formats: '.jpg,.jpeg,.png', order: 2 },
                { id: 'kyc_sii', name: 'Carpeta Tributaria (SII)', desc: 'Documento de Iniciación de Actividades o Carpeta Tributaria emitido por el SII.', fileType: 'document', formats: '.pdf,.jpg,.jpeg,.png', order: 3 },
                { id: 'kyc_address', name: 'Comprobante de Domicilio', desc: 'Cuenta de servicios básicos o certificado de domicilio con antigüedad máxima de 3 meses.', fileType: 'document', formats: '.pdf,.jpg,.jpeg,.png', order: 4 },
                { id: 'kyc_criminal_record', name: 'Certificado de Antecedentes', desc: 'Certificado de antecedentes penales emitido por el Registro Civil con antigüedad máxima de 30 días.', fileType: 'document', formats: '.pdf', order: 5, expiration: true }
            ];

            for (const doc of seedDocs) {
                await client.query(`
                    INSERT INTO verification_requirements (id, name, description, file_type, accepted_formats, sort_order, expiration_required, required_for_role, is_mandatory, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'provider', TRUE, TRUE)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        file_type = EXCLUDED.file_type,
                        accepted_formats = EXCLUDED.accepted_formats,
                        sort_order = EXCLUDED.sort_order,
                        expiration_required = EXCLUDED.expiration_required
                `, [doc.id, doc.name, doc.desc, doc.fileType, doc.formats, doc.order, doc.expiration || false]);
            }

            // 3. Create rejection_reasons table
            await client.query(`
                CREATE TABLE IF NOT EXISTS rejection_reasons (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    reason TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // 4. Seed default rejection reasons
            const seedReasons = [
                'Documento borroso o ilegible',
                'Documento vencido',
                'Nombre no coincide con el perfil',
                'Archivo corrupto o formato no válido',
                'Falta reverso de la cédula',
                'Certificado con antigüedad mayor a 30 días'
            ];

            for (let i = 0; i < seedReasons.length; i++) {
                await client.query(`
                    INSERT INTO rejection_reasons (reason, sort_order)
                    SELECT $1, $2
                    WHERE NOT EXISTS (SELECT 1 FROM rejection_reasons WHERE reason = $1)
                `, [seedReasons[i], i + 1]);
            }

            await client.query('COMMIT');
            res.json({
                status: 'success',
                message: 'KYC migration completed. Tables verification_requirements and rejection_reasons created/updated with seed data.'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
};

// --- REJECTION REASONS CRUD ---
export const getRejectionReasons = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM rejection_reasons WHERE is_active = true ORDER BY sort_order ASC, reason ASC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        if (err.code === '42P01') return res.json({ status: 'success', data: [] });
        next(err);
    }
};

export const upsertRejectionReason = async (req, res, next) => {
    try {
        const { id, reason, sortOrder } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ status: 'error', message: 'reason is required' });
        }

        let result;
        if (id) {
            result = await pool.query(
                'UPDATE rejection_reasons SET reason = $1, sort_order = $2 WHERE id = $3 RETURNING *',
                [reason.trim(), sortOrder || 0, id]
            );
        } else {
            result = await pool.query(
                'INSERT INTO rejection_reasons (reason, sort_order) VALUES ($1, $2) RETURNING *',
                [reason.trim(), sortOrder || 0]
            );
        }
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

export const deleteRejectionReason = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM rejection_reasons WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ status: 'error', message: 'Reason not found' });
        res.json({ status: 'success', message: 'Rejection reason deleted' });
    } catch (err) {
        next(err);
    }
};

// --- ATTRIBUTES & TEMPLATES MANAGEMENT ---

// Attributes
export const getServiceAttributes = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM service_attributes ORDER BY category_id, name ASC';
        const result = await pool.query(query);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        if (err.code === '42P01') return res.json({ status: 'success', data: [] });
        next(err);
    }
};

export const upsertServiceAttribute = async (req, res, next) => {
    try {
        const { id, name, type, options, categoryId, isActive } = req.body;
        const cleanId = id || name.toLowerCase().replace(/ /g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const query = `
            INSERT INTO service_attributes(id, name, type, options, category_id, is_active)
        VALUES($1, $2, $3, $4, $5, $6)
            ON CONFLICT(id) 
            DO UPDATE SET
        name = EXCLUDED.name,
            type = EXCLUDED.type,
            options = EXCLUDED.options,
            category_id = EXCLUDED.category_id,
            is_active = EXCLUDED.is_active
        RETURNING *
            `;
        const result = await pool.query(query, [cleanId, name, type, JSON.stringify(options || []), categoryId, isActive]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

export const deleteServiceAttribute = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM service_attributes WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ status: 'error', message: 'Attribute not found' });
        res.json({ status: 'success', message: 'Attribute deleted' });
    } catch (err) {
        next(err);
    }
};

// Templates
export const getContentTemplates = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM content_templates ORDER BY name ASC';
        const result = await pool.query(query);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        if (err.code === '42P01') return res.json({ status: 'success', data: [] });
        next(err);
    }
};

export const updateContentTemplate = async (req, res, next) => {
    try {
        const { id, content, subject } = req.body;
        const query = `
            UPDATE content_templates 
            SET content = $1, subject = COALESCE($2, subject), updated_at = CURRENT_TIMESTAMP 
            WHERE id = $3
        RETURNING *
            `;
        const result = await pool.query(query, [content, subject, id]);
        if (result.rowCount === 0) return res.status(404).json({ status: 'error', message: 'Template not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};
// --- ANALYTICS & REPORTING ---

// GET /api/admin/analytics
export const getAdvancedStats = async (req, res, next) => {
    try {
        // 1. Financials
        await ensureBookingPricingColumns();
        const revenueRes = await pool.query(`
            SELECT b.amount, b.base_amount, b.platform_fee, b.commission_rate, b.commission_type, b.fixed_commission,
                   sc.commission_percentage as category_commission_percentage,
                   sc.commission_type as category_commission_type,
                   sc.fixed_commission as category_fixed_commission
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE b.status IN ('in_escrow', 'service_completed', 'released')
        `);
        const totalRevenue = revenueRes.rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
        const commissions = revenueRes.rows.reduce((sum, row) => sum + getBookingPricingFromRow(row).platformFee, 0);

        // Disputes
        const disputesRes = await pool.query("SELECT COUNT(*) FROM support_tickets WHERE type = 'dispute' AND status = 'open'");
        const openDisputes = parseInt(disputesRes.rows[0].count);

        // 2. Operations
        const activeProviders = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'provider'");
        // Orders today: bookings created today
        const ordersTodayRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = CURRENT_DATE");

        // 3. Health & Retention
        const newUsersRes = await pool.query("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE");
        const kycPendingRes = await pool.query("SELECT COUNT(*) FROM provider_profiles WHERE verification_status = 'pending'");

        // 4. Legal
        // Mocking some legal stats as we don't have tables for them yet
        const pendingSii = 0;

        res.json({
            status: 'success',
            data: {
                f1: { value: totalRevenue, trend: 0 }, // Saldo Payku (Mocked as Total Revenue for now)
                f2: { value: commissions, trend: 0 }, // Comisiones
                f3: { value: pendingSii, trend: 0 }, // Retenciones SII
                f5: { value: openDisputes, trend: 0 }, // Disputas
                o1: { value: parseInt(activeProviders.rows[0].count), trend: 0 }, // Proveedores Activos
                o2: { value: parseInt(ordersTodayRes.rows[0].count), trend: 0 }, // Órdenes Hoy
                o6: { value: parseInt(kycPendingRes.rows[0].count), trend: 0 }, // Pendiente KYC
                s1: { value: parseInt(newUsersRes.rows[0].count), trend: 0 }, // Nuevos Clientes
                s5: { value: totalRevenue, trend: 0 }, // Liquidez (Same as revenue for now)
                l1: { value: 0, trend: 0 }, // Reportes SII Pendientes
                l3: { value: 0, trend: 0 } // Proveedores sin seguro
            }
        });

    } catch (err) {
        next(err);
    }
};

// GET /api/admin/reports/:type
export const downloadReport = async (req, res, next) => {
    try {
        const { type } = req.params;
        const { from, to } = req.query; // Date filters if needed

        let filename = `report_${type}_${Date.now()}.csv`;
        let content = '';

        if (type === 'sales_book') {
            // CSV: ID, Date, Client, Provider, Amount, Status
            const query = `
                SELECT b.id, b.created_at, u.full_name as client, p.full_name as provider, b.amount, b.status
                FROM bookings b
                JOIN users u ON b.client_id = u.id
                JOIN users p ON b.provider_id = p.id
                ORDER BY b.created_at DESC
            `;
            const result = await pool.query(query);

            content = 'Orden ID,Fecha,Cliente,Proveedor,Monto,Estado\n';
            result.rows.forEach(row => {
                content += `${row.id},${new Date(row.created_at).toISOString()}, "${row.client}", "${row.provider}", ${row.amount},${row.status} \n`;
            });

        } else if (type === 'sii_retentions') {
            // Mock XML structure for SII
            filename = `sii_retentions_${Date.now()}.xml`;
            res.setHeader('Content-Type', 'application/xml');
            content = `< ResumenRetenciones >\n < Periodo > ${new Date().toISOString().slice(0, 7)}</Periodo >\n < TotalRetenido > 0</TotalRetenido >\n</ResumenRetenciones > `;

        } else if (type === 'sernac') {
            // CSV: Ticket ID, User, Subject, Status
            const query = `SELECT id, user_id, subject, status, created_at FROM support_tickets`;
            const result = await pool.query(query);
            content = 'Ticket ID,Usuario ID,Asunto,Estado,Fecha\n';
            result.rows.forEach(row => {
                content += `${row.id},${row.user_id}, "${row.subject}", ${row.status},${new Date(row.created_at).toISOString()} \n`;
            });
        } else if (type === 'settlements') {
            // CSV: Payku transactions
            content = 'ID Transaccion,Fecha,Monto,Estado\n';
            // Fetch real if Payku integration exists, else mock empty
        } else {
            return res.status(400).json({ status: 'error', message: 'Invalid report type' });
        }

        if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'text/csv');
        }
        res.setHeader('Content-Disposition', `attachment; filename = ${filename} `);
        res.status(200).send(content);

    } catch (err) {
        next(err);
    }
};

// --- DATA CLEANUP ---
export const cleanOrphanServices = async (req, res, next) => {
    try {
        // 1. Delete services where provider_id does not exist in users table (Deleted Users)
        const result = await pool.query(`
            DELETE FROM services 
            WHERE provider_id NOT IN(SELECT id FROM users)
            RETURNING id, title;
        `);

        // 2. Delete services where provider_id exists in users but NOT in provider_profiles (Incomplete Profiles)
        // This handles cases where a user registered as provider but didn't complete profile
        const result2 = await pool.query(`
            DELETE FROM services 
            WHERE provider_id IN(SELECT id FROM users WHERE role = 'provider') 
            AND provider_id NOT IN(SELECT user_id FROM provider_profiles)
            RETURNING id, title;
        `);

        res.json({
            status: 'success',
            message: 'Cleanup completed',
            deletedOrphans: result.rows,
            deletedIncomplete: result2.rows
        });
    } catch (err) {
        next(err);
    }
};

// --- DEBUG INSPECTION ---
export const inspectServiceConsistency = async (req, res, next) => {
    try {
        const query = `
        SELECT
        s.id as service_id,
            s.title,
            s.provider_id,
            u.id IS NOT NULL as user_exists,
                u.role as user_role,
                p.user_id IS NOT NULL as profile_exists,
                    p.full_name as profile_name
            FROM services s
            LEFT JOIN users u ON s.provider_id = u.id
            LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
            ORDER BY s.created_at DESC
            `;
        const result = await pool.query(query);

        res.json({
            status: 'success',
            report: result.rows
        });
    } catch (err) {
        next(err);
    }
};

// --- DATA CLEANUP TOOL ---
export const cleanupTestData = async (req, res, next) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Identify Test Users (by pattern used in seed scripts)
            // Pattern: 'prov_%@test.com' or 'client_%@test.com'
            const findUsersQuery = `
                SELECT id FROM users 
                WHERE email LIKE 'prov_%@test.com' 
                   OR email LIKE 'client_%@test.com'
            `;
            const userRes = await client.query(findUsersQuery);
            const userIds = userRes.rows.map(u => u.id);

            if (userIds.length > 0) {
                // 2. Delete Bookings (Transactions)
                // Use ANY for array parameters in Postgres
                await client.query(`DELETE FROM bookings WHERE client_id = ANY($1) OR provider_id = ANY($1)`, [userIds]);

                // 3. Delete Reviews (Check if table exists first)
                const tableCheck = await client.query("SELECT to_regclass('public.reviews')");
                if (tableCheck.rows[0].to_regclass) {
                    await client.query(`DELETE FROM reviews WHERE provider_id = ANY($1) OR client_id = ANY($1)`, [userIds]);
                }

                // 4. Delete Services
                await client.query(`DELETE FROM services WHERE provider_id = ANY($1)`, [userIds]);

                // 5. Delete Provider Profiles
                await client.query(`DELETE FROM provider_profiles WHERE user_id = ANY($1)`, [userIds]);

                // 6. Delete Users
                await client.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
            }

            await client.query('COMMIT');

            res.json({
                status: 'success',
                message: `Cleanup Successful.Deleted ${userIds.length} test users and all associated data(bookings, services, reviews).`,
                deletedUserIds: userIds
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
};

// POST /api/admin/sync-provider-verification
// Recalculates is_verified for all providers based on current document statuses
export const syncProviderVerification = async (req, res, next) => {
    try {
        // Fetch mandatory KYC requirements
        let mandatoryFields = [];
        try {
            const mandatoryRes = await pool.query("SELECT id FROM verification_requirements WHERE is_active = true AND is_mandatory = true");
            mandatoryFields = mandatoryRes.rows.map(r => r.id);
        } catch (e) {
            // fallback if table does not exist or query fails
        }
        if (mandatoryFields.length === 0) {
            mandatoryFields = ['kyc_id_front', 'kyc_id_back', 'kyc_sii', 'kyc_address', 'kyc_criminal_record'];
        }

        // 1. Fetch all provider profiles with documents
        const profilesRes = await pool.query('SELECT user_id, kyc_documents, is_verified FROM provider_profiles');

        let updatedCount = 0;
        const updates = [];

        for (const profile of profilesRes.rows) {
            const docs = profile.kyc_documents || {};

            // Calculate expected verification status: every mandatory doc must exist and be approved
            const shouldVerify = mandatoryFields.every(field => {
                const doc = docs[field];
                return doc && (doc.status === 'approved' || doc.status === 'Aprobado');
            });

            // Only update if current state doesn't match expected
            if (profile.is_verified !== shouldVerify) {
                await pool.query(
                    'UPDATE provider_profiles SET is_verified = $1 WHERE user_id = $2',
                    [shouldVerify, profile.user_id]
                );
                updatedCount++;
                updates.push({
                    userId: profile.user_id,
                    oldStatus: profile.is_verified,
                    newStatus: shouldVerify
                });
            }
        }

        console.log(`[Sync] Updated ${updatedCount} provider verification statuses.`);

        res.json({
            status: 'success',
            message: `Synchronized ${updatedCount} provider(s)`,
            updated: updates
        });

    } catch (err) {
        next(err);
    }
};

// =====================================================
// PROMOTION TIERS CRUD
// =====================================================

const normalizePromotionTierPayload = (body, { partial = false } = {}) => {
    const normalized = {};
    const errors = [];

    if (!partial || body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) errors.push('Nombre es requerido');
        normalized.name = name;
    }

    if (!partial || body.duration_days !== undefined) {
        const durationDays = Number.parseInt(body.duration_days, 10);
        if (!Number.isInteger(durationDays) || durationDays <= 0) errors.push('Duracion debe ser mayor a 0');
        normalized.duration_days = durationDays;
    }

    if (!partial || body.price_clp !== undefined) {
        const priceClp = Number.parseInt(body.price_clp, 10);
        if (!Number.isInteger(priceClp) || priceClp <= 0) errors.push('Precio debe ser mayor a 0');
        normalized.price_clp = priceClp;
    }

    if (body.description !== undefined) normalized.description = String(body.description || '').trim();
    if (body.is_active !== undefined) normalized.is_active = Boolean(body.is_active);
    if (body.display_order !== undefined) {
        const displayOrder = Number.parseInt(body.display_order, 10);
        if (!Number.isInteger(displayOrder) || displayOrder < 0) errors.push('Orden no puede ser negativo');
        normalized.display_order = displayOrder;
    }
    if (body.payment_url !== undefined) {
        const paymentUrl = String(body.payment_url || '').trim();
        if (paymentUrl && !/^https?:\/\//i.test(paymentUrl)) errors.push('Link de pago debe ser una URL valida');
        normalized.payment_url = paymentUrl;
    }

    return { normalized, errors };
};

// GET /api/admin/promotion-tiers
export const getPromotionTiers = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT * FROM promotion_tiers
            ORDER BY display_order ASC, created_at ASC
        `);

        res.json({
            status: 'success',
            tiers: result.rows
        });
    } catch (err) {
        logger.error(`Get Promotion Tiers Error: ${err.message}`);
        next(err);
    }
};

// POST /api/admin/promotion-tiers
export const createPromotionTier = async (req, res, next) => {
    try {
        const { normalized, errors } = normalizePromotionTierPayload(req.body);

        if (errors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: errors.join('. ')
            });
        }

        const {
            name,
            duration_days,
            price_clp,
            description = '',
            is_active = true,
            display_order = 0,
            payment_url = ''
        } = normalized;

        const result = await pool.query(`
            INSERT INTO promotion_tiers (name, duration_days, price_clp, description, is_active, display_order, payment_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [name, duration_days, price_clp, description || '', is_active, display_order, payment_url]);

        logger.info(`Promotion tier created: ${name}`);

        res.status(201).json({
            status: 'success',
            tier: result.rows[0]
        });
    } catch (err) {
        logger.error(`Create Promotion Tier Error: ${err.message}`);
        next(err);
    }
};

// PUT /api/admin/promotion-tiers/:id
export const updatePromotionTier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { normalized, errors } = normalizePromotionTierPayload(req.body, { partial: true });

        if (errors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: errors.join('. ')
            });
        }

        const { name, duration_days, price_clp, description, is_active, display_order, payment_url } = normalized;

        const result = await pool.query(`
            UPDATE promotion_tiers
            SET 
                name = COALESCE($1, name),
                duration_days = COALESCE($2, duration_days),
                price_clp = COALESCE($3, price_clp),
                description = COALESCE($4, description),
                is_active = COALESCE($5, is_active),
                display_order = COALESCE($6, display_order),
                payment_url = COALESCE($7, payment_url),
                updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `, [name, duration_days, price_clp, description, is_active, display_order, payment_url, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Plan de promoción no encontrado'
            });
        }

        logger.info(`Promotion tier updated: ${id}`);

        res.json({
            status: 'success',
            tier: result.rows[0]
        });
    } catch (err) {
        logger.error(`Update Promotion Tier Error: ${err.message}`);
        next(err);
    }
};

// DELETE /api/admin/promotion-tiers/:id
export const deletePromotionTier = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if tier is in use
        const inUse = await pool.query(
            'SELECT COUNT(*) FROM featured_promotions WHERE tier_id = $1',
            [id]
        );

        if (parseInt(inUse.rows[0].count) > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Este plan está en uso por ${inUse.rows[0].count} promoción(es) activa(s). Desactívalo en lugar de eliminarlo.`
            });
        }

        const result = await pool.query(
            'DELETE FROM promotion_tiers WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Plan de promoción no encontrado'
            });
        }

        logger.info(`Promotion tier deleted: ${id}`);

        res.json({
            status: 'success',
            message: 'Plan de promoción eliminado'
        });
    } catch (err) {
        logger.error(`Delete Promotion Tier Error: ${err.message}`);
        next(err);
    }
};

// --- SIMPLE FACTURA INTEGRATION ---
import simpleFacturaService from '../services/simpleFacturaService.js';

const ensureProviderMonthlySettlementsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS provider_monthly_settlements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES users(id),
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            bookings_count INTEGER NOT NULL DEFAULT 0,
            gross_amount INTEGER NOT NULL DEFAULT 0,
            platform_fee INTEGER NOT NULL DEFAULT 0,
            provider_payout INTEGER NOT NULL DEFAULT 0,
            dte_folio VARCHAR(50),
            dte_url VARCHAR(512),
            dte_status VARCHAR(50) DEFAULT 'pending',
            dte_raw JSONB,
            generated_by UUID REFERENCES users(id),
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(provider_id, period_start, period_end)
        )
    `);
};

const getInvoicingSettings = async () => {
    const settingsRes = await pool.query("SELECT * FROM platform_settings WHERE group_name = 'invoicing'");
    const settings = {};
    settingsRes.rows.forEach(row => {
        settings[row.key] = row.value;
    });
    return settings;
};

const getMonthPeriod = ({ year, month, periodStart, periodEnd }) => {
    if (periodStart && periodEnd) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
            throw new Error('Formato de periodo invalido. Usa YYYY-MM-DD.');
        }
        return { periodStart, periodEnd };
    }

    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
        throw new Error('Debe indicar year y month validos.');
    }

    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return {
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10)
    };
};

export const testSimpleFacturaConnection = async (req, res, next) => {
    try {
        // We get credentials from DB settings to ensure we test what is SAVED
        // OR we can allow passing them in body to test before save.
        // The frontend saves first, then tests? Or tests manual inputs?
        // UI code: handleTestConnection calls POST /test-connection with NO body. 
        // Logic: "disabled={testing || !config.username}". 

        // Wait, the UI MarketplaceConfig.tsx calls:
        // const response = await fetch('/api/admin/invoicing/test-connection', { method: 'POST' });
        // It does NOT pass body. So we must fetch from DB.

        // Fetch current settings
        const settingsRes = await pool.query("SELECT * FROM platform_settings WHERE group_name = 'invoicing'");
        const settings = {};
        settingsRes.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        console.log('[SimpleFactura Test] Settings fetched from DB:', Object.keys(settings));
        if (!settings.simplefactura_username) console.log('[SimpleFactura Test] Missing username in DB');
        if (!settings.simplefactura_password) console.log('[SimpleFactura Test] Missing password in DB');

        const config = {
            username: settings.simplefactura_username,
            password: settings.simplefactura_password,
            environment: settings.simplefactura_environment || 'sandbox'
        };

        if (!config.username || !config.password) {
            return res.status(400).json({
                status: 'error',
                message: 'No hay credenciales configuradas en la base de datos. Asegúrese de haber hecho clic en "Guardar Cambios" y que la operación fue exitosa.'
            });
        }

        const result = await simpleFacturaService.testConnection(config);

        if (result.success) {
            res.json({
                status: 'success',
                message: 'Conexión exitosa con SimpleFactura'
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: result.message || 'Error de autenticación'
            });
        }

    } catch (err) {
        logger.error(`SimpleFactura Test Error: ${err.message}`);
        next(err);
    }
};

// ============================================================
// QUICK ACTIONS — Admin Client Profile
// ============================================================

export const generateProviderMonthlySettlement = async (req, res, next) => {
    try {
        const providerId = req.params.id;
        const adminId = req.user.id;
        const { periodStart, periodEnd } = getMonthPeriod(req.body || {});
        const force = req.body?.force === true;

        await ensureBookingPricingColumns();
        await ensureProviderMonthlySettlementsTable();

        const settings = await getInvoicingSettings();
        const invoicingEnabled = settings.simplefactura_status === true || settings.simplefactura_status === 'true';
        if (!invoicingEnabled || !settings.simplefactura_username || !settings.simplefactura_password) {
            return res.status(400).json({
                status: 'error',
                message: 'SimpleFactura debe estar activo y con credenciales guardadas antes de emitir liquidaciones.'
            });
        }

        const providerRes = await pool.query(`
            SELECT u.id, u.email, pp.full_name, pp.store_name, pp.rut, pp.coverage_area
            FROM users u
            JOIN provider_profiles pp ON u.id = pp.user_id
            WHERE u.id = $1 AND u.role = 'provider'
        `, [providerId]);

        if (providerRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Proveedor no encontrado.' });
        }

        const provider = providerRes.rows[0];
        if (!provider.rut) {
            return res.status(400).json({
                status: 'error',
                message: 'El proveedor no tiene RUT configurado para emitir la liquidacion.'
            });
        }

        const previousRes = await pool.query(
            `SELECT id, dte_status, dte_folio, dte_url
             FROM provider_monthly_settlements
             WHERE provider_id = $1 AND period_start = $2 AND period_end = $3`,
            [providerId, periodStart, periodEnd]
        );

        if (previousRes.rows[0]?.dte_status === 'generated' && !force) {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe una liquidacion generada para este proveedor y periodo.',
                settlement: previousRes.rows[0]
            });
        }

        const bookingsRes = await pool.query(`
            SELECT b.id, b.amount, b.base_amount, b.platform_fee, b.commission_rate, b.commission_type, b.fixed_commission,
                   b.paid_at, b.created_at,
                   sc.commission_percentage as category_commission_percentage,
                   sc.commission_type as category_commission_type,
                   sc.fixed_commission as category_fixed_commission
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE b.provider_id = $1
              AND b.status IN ('in_escrow', 'service_completed', 'released')
              AND COALESCE(b.paid_at, b.created_at)::date >= $2::date
              AND COALESCE(b.paid_at, b.created_at)::date <= $3::date
            ORDER BY COALESCE(b.paid_at, b.created_at) ASC
        `, [providerId, periodStart, periodEnd]);

        if (bookingsRes.rows.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No hay operaciones pagadas para este proveedor en el periodo seleccionado.'
            });
        }

        const summary = bookingsRes.rows.reduce((acc, row) => {
            const pricing = getBookingPricingFromRow(row);
            const serviceAmount = Math.max(0, pricing.baseAmount || ((Number(row.amount) || 0) - pricing.platformFee));
            acc.grossAmount += serviceAmount;
            acc.platformFee += pricing.platformFee;
            acc.providerPayout += serviceAmount;
            return acc;
        }, { grossAmount: 0, platformFee: 0, providerPayout: 0 });

        const settlementRes = await pool.query(`
            INSERT INTO provider_monthly_settlements (
                provider_id, period_start, period_end, bookings_count, gross_amount, platform_fee, provider_payout,
                dte_status, generated_by, generated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, CURRENT_TIMESTAMP)
            ON CONFLICT(provider_id, period_start, period_end)
            DO UPDATE SET
                bookings_count = EXCLUDED.bookings_count,
                gross_amount = EXCLUDED.gross_amount,
                platform_fee = EXCLUDED.platform_fee,
                provider_payout = EXCLUDED.provider_payout,
                dte_status = 'pending',
                generated_by = EXCLUDED.generated_by,
                generated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            providerId,
            periodStart,
            periodEnd,
            bookingsRes.rows.length,
            summary.grossAmount,
            summary.platformFee,
            summary.providerPayout,
            adminId
        ]);

        const settlement = settlementRes.rows[0];
        const authConfig = {
            username: settings.simplefactura_username,
            password: settings.simplefactura_password,
            rutEmisor: settings.simplefactura_rut_emisor,
            environment: settings.simplefactura_environment || 'sandbox'
        };

        try {
            const dteResult = await simpleFacturaService.generateProviderMonthlySettlement(authConfig, {
                id: settlement.id,
                provider: {
                    rut: provider.rut,
                    full_name: provider.full_name,
                    store_name: provider.store_name,
                    email: provider.email,
                    address: provider.coverage_area || 'Domicilio Proveedor',
                    city: provider.coverage_area || 'Santiago'
                },
                periodStart,
                periodEnd,
                bookingsCount: bookingsRes.rows.length,
                grossAmount: summary.grossAmount,
                platformFee: summary.platformFee,
                providerPayout: summary.providerPayout
            });

            const updatedRes = await pool.query(`
                UPDATE provider_monthly_settlements
                SET dte_folio = $1, dte_url = $2, dte_status = 'generated', dte_raw = $3
                WHERE id = $4
                RETURNING *
            `, [dteResult.data.folio, dteResult.data.url, JSON.stringify(dteResult.data.raw || {}), settlement.id]);

            return res.json({
                status: 'success',
                message: 'Liquidacion mensual emitida correctamente.',
                settlement: updatedRes.rows[0]
            });
        } catch (dteErr) {
            await pool.query(
                "UPDATE provider_monthly_settlements SET dte_status = 'failed' WHERE id = $1",
                [settlement.id]
            );
            throw dteErr;
        }
    } catch (err) {
        logger.error(`Provider Monthly Settlement Error: ${err.message}`);
        next(err);
    }
};

// GET /api/admin/db-migrate/add-is-blocked
// Adds is_blocked column to users table (run once)
export const migrateAddIsBlocked = async (req, res, next) => {
    try {
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE
        `);
        // Also create coupons table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_coupons (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code VARCHAR(50) NOT NULL,
                discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
                discount_value NUMERIC(10,2) NOT NULL,
                is_used BOOLEAN DEFAULT FALSE,
                expires_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by_admin_id UUID REFERENCES users(id)
            )
        `);
        res.json({ status: 'success', message: 'Migration applied: is_blocked, reset_token, user_coupons table created.' });
    } catch (err) {
        next(err);
    }
};

// PUT /api/admin/clients/:id/block
// Toggle the is_blocked status of a client
export const blockClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Fetch current status
        const current = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [id]);
        if (current.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });

        const newStatus = !current.rows[0].is_blocked;
        await pool.query('UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2', [newStatus, id]);

        res.json({
            status: 'success',
            message: newStatus ? 'Cuenta bloqueada exitosamente.' : 'Cuenta desbloqueada exitosamente.',
            data: { is_blocked: newStatus }
        });
    } catch (err) {
        next(err);
    }
};

// POST /api/admin/clients/:id/force-reset-password
// Generate a temporary password reset token for the client
export const forcePasswordReset = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });

        // Generate a simple random token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() WHERE id = $3',
            [token, expires, id]
        );

        // In production: send email. For now, return the reset link.
        const resetLink = `${process.env.APP_URL || process.env.FRONTEND_URL || 'https://serviciosatuhogar.cl'}/reset-password?token=${token}`;

        res.json({
            status: 'success',
            message: `Token de reset generado para ${user.rows[0].email}. Válido por 24 horas.`,
            data: { resetLink, token, email: user.rows[0].email }
        });
    } catch (err) {
        next(err);
    }
};

// POST /api/admin/clients/:id/apply-coupon
// Manually apply a coupon to a specific client
export const applyManualCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { discount_type, discount_value, expires_in_days } = req.body;

        if (!discount_type || !discount_value) {
            return res.status(400).json({ status: 'error', message: 'discount_type y discount_value son requeridos.' });
        }

        const adminId = req.user?.id;
        const code = 'ADMIN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = expires_in_days
            ? new Date(Date.now() + parseInt(expires_in_days) * 24 * 60 * 60 * 1000)
            : null;

        await pool.query(
            `INSERT INTO user_coupons (user_id, code, discount_type, discount_value, expires_at, created_by_admin_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, code, discount_type, discount_value, expiresAt, adminId]
        );

        res.json({
            status: 'success',
            message: `Cupón ${code} aplicado exitosamente.`,
            data: { code, discount_type, discount_value }
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /api/admin/clients/:id/data
// Anonymize client data to comply with Ley 19.628 (Chilean Data Protection Law)
export const deleteClientData = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });

        const anonymizedEmail = `deleted_${id.substring(0, 8)}@anonimizado.internal`;

        // Anonymize PII in users table. Keep record for referential integrity.
        await pool.query(
            `UPDATE users SET
                email = $1,
                password_hash = 'DELETED',
                is_blocked = TRUE,
                updated_at = NOW()
             WHERE id = $2`,
            [anonymizedEmail, id]
        );

        // Anonymize provider_profiles if exists
        await pool.query(
            `UPDATE provider_profiles SET
                full_name = 'Usuario Eliminado',
                phone = NULL,
                bio = NULL
             WHERE user_id = $1`,
            [id]
        );

        logger.warn(`[ADMIN] Data deletion (Ley 19.628) applied to user ${id} by admin ${req.user?.id}`);

        res.json({
            status: 'success',
            message: 'Los datos personales del usuario han sido anonimizados conforme a la Ley 19.628.'
        });
    } catch (err) {
        next(err);
    }
};

export const updateCategoriesCommissionMigration = async (req, res, next) => {
    try {
        await pool.query(`
            ALTER TABLE service_categories
            ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) DEFAULT 'PERCENTAGE',
            ADD COLUMN IF NOT EXISTS fixed_commission INTEGER DEFAULT 0;
        `);
        res.json({
            status: 'success',
            message: 'Migración completada. Columnas commission_type y fixed_commission añadidas a service_categories.'
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/dashboard-charts
export const getDashboardCharts = async (req, res, next) => {
    try {
        // 1. Monthly Revenue & Bookings (last 6 months)
        const revenueQuery = `
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
                COALESCE(SUM(amount), 0) as revenue,
                COUNT(*) as bookings
            FROM bookings
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
        `;
        const revenueResult = await pool.query(revenueQuery);

        // 2. New Users by Month (last 6 months) - split by role
        const usersQuery = `
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
                COUNT(*) FILTER (WHERE role = 'client') as clients,
                COUNT(*) FILTER (WHERE role = 'provider') as providers,
                COUNT(*) as total
            FROM users
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
        `;
        const usersResult = await pool.query(usersQuery);

        // 3. Booking Status Distribution (current)
        const statusQuery = `
            SELECT 
                status,
                COUNT(*) as count
            FROM bookings
            GROUP BY status
            ORDER BY count DESC
        `;
        const statusResult = await pool.query(statusQuery);

        // 4. Top Services by Bookings (top 5)
        const topServicesQuery = `
            SELECT 
                s.title,
                COUNT(b.id) as booking_count,
                COALESCE(SUM(b.amount), 0) as total_revenue
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            GROUP BY s.id, s.title
            ORDER BY booking_count DESC
            LIMIT 5
        `;
        const topServicesResult = await pool.query(topServicesQuery);

        res.json({
            status: 'success',
            data: {
                revenueByMonth: revenueResult.rows.map(r => ({
                    month: r.month,
                    label: r.label,
                    revenue: parseFloat(r.revenue),
                    bookings: parseInt(r.bookings)
                })),
                userGrowth: usersResult.rows.map(r => ({
                    month: r.month,
                    label: r.label,
                    clients: parseInt(r.clients),
                    providers: parseInt(r.providers),
                    total: parseInt(r.total)
                })),
                bookingsByStatus: statusResult.rows.map(r => ({
                    status: r.status,
                    count: parseInt(r.count)
                })),
                topServices: topServicesResult.rows.map(r => ({
                    title: r.title,
                    bookings: parseInt(r.booking_count),
                    revenue: parseFloat(r.total_revenue)
                }))
            }
        });
    } catch (err) {
        console.error('[DASHBOARD_CHARTS] Error:', err);
        next(err);
    }
};

// GET /api/admin/migrations/run-guest-checkout
export const runGuestCheckoutMigration = async (req, res, next) => {
    try {
        await pool.query(`
            ALTER TABLE bookings ALTER COLUMN client_id DROP NOT NULL;
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);
        `);
        res.json({
            status: 'success',
            message: 'Migración completada. Modificaciones aplicadas a la tabla bookings para invitados.'
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/setup-pricing-type
export const setupPricingTypeMigration = async (req, res, next) => {
    try {
        await pool.query(`
            ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'per_event';
        `);
        await pool.query(`
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_times JSONB DEFAULT '[]'::jsonb;
        `);
        await pool.query(`
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 1;
        `);
        res.json({ status: 'success', message: '¡Migración de Pricing Type y Múltiples Horas aplicada con éxito!' });
    } catch (err) {
        console.error('[PRICING_MIGRATION] Error:', err);
        next(err);
    }
};
