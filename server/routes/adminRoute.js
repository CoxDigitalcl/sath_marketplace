
import express from 'express';
import {
    getAdminStats, getAllUsers, getProviders,
    getClients,
    getClientProfile,
    getTransactions,
    getModeration,
    getTickets,
    getSystemStats,
    createTicket,
    getTicketDetail,
    addTicketMessage,
    updateTicketStatus,
    getAdminClaims,
    resolveClaim,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getSettings,
    updateSettings,
    getPolicies,
    upsertPolicy,
    deletePolicy,
    getVerificationRequirements,
    upsertVerificationRequirement,
    deleteVerificationRequirement,
    getRejectionReasons,
    upsertRejectionReason,
    deleteRejectionReason,
    getServiceAttributes,
    upsertServiceAttribute,
    deleteServiceAttribute,
    getContentTemplates,
    updateContentTemplate,
    getAdvancedStats,
    downloadReport,
    syncProviderVerification,
    getPromotionTiers,
    createPromotionTier,
    updatePromotionTier,
    deletePromotionTier,
    testSimpleFacturaConnection,
    generateProviderMonthlySettlement,
    resolveImageModeration,
    blockClient,
    forcePasswordReset,
    applyManualCoupon,
    deleteClientData,
    getDashboardCharts,
} from '../controllers/adminController.js';

import { getProviderDetails, getProviderServices, updateDocumentStatus, togglePayouts } from '../controllers/providerController.js';
import { getAdminServices, getAdminPromotions, toggleStaffPick, moderateService, deletePromotion, updatePromotionStatus } from '../controllers/serviceController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ status: 'error', message: 'Admin access required' });
    }
};

// Protect all admin routes defined below
router.use(authenticateToken);
router.use(requireAdmin);

// Transactions
router.get('/transactions', getTransactions);
// Moderation
router.get('/moderation', getModeration);
router.post('/moderation/images/:providerId/resolve', resolveImageModeration);

// Tickets
router.get('/tickets', getTickets);
router.post('/tickets', createTicket);
router.get('/tickets/:ticketId', getTicketDetail);
router.post('/tickets/:ticketId/messages', addTicketMessage);
router.patch('/tickets/:ticketId/status', updateTicketStatus);

// Claims Management
router.get('/claims', getAdminClaims);
router.patch('/claims/:claimId/resolve', resolveClaim);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Settings
router.get('/settings/:group', getSettings);
router.post('/settings', updateSettings);
// SimpleFactura Test
router.post('/invoicing/test-connection', testSimpleFacturaConnection);

// Policies
router.get('/policies', getPolicies);
router.post('/policies', upsertPolicy);
router.delete('/policies/:id', deletePolicy);

// Verification Settings
router.get('/verification-requirements', getVerificationRequirements);
router.post('/verification-requirements', upsertVerificationRequirement);
router.delete('/verification-requirements/:id', deleteVerificationRequirement);

// Rejection Reasons
router.get('/rejection-reasons', getRejectionReasons);
router.post('/rejection-reasons', upsertRejectionReason);
router.delete('/rejection-reasons/:id', deleteRejectionReason);

// Attributes
router.get('/attributes', getServiceAttributes);
router.post('/attributes', upsertServiceAttribute);
router.delete('/attributes/:id', deleteServiceAttribute);

// Templates
router.get('/templates', getContentTemplates);
router.put('/templates/:id', updateContentTemplate);

// Analytics & Reports
router.get('/analytics', getAdvancedStats);
router.get('/reports/:type', downloadReport);

router.get('/system-status', getSystemStats);
router.get('/stats', getAdminStats);
router.get('/dashboard-charts', getDashboardCharts);
router.get('/users', getAllUsers);
router.get('/providers', getProviders);
router.get('/providers/:id', getProviderDetails);
router.get('/providers/:id/services', getProviderServices);
router.post('/providers/:id/monthly-settlement', generateProviderMonthlySettlement);
router.put('/providers/:id/documents', updateDocumentStatus);
router.put('/providers/:id/payouts', togglePayouts);
router.post('/sync-provider-verification', syncProviderVerification);
router.get('/clients', getClients);
router.get('/clients/:id/profile', getClientProfile);
router.put('/clients/:id/block', blockClient);
router.post('/clients/:id/force-reset-password', forcePasswordReset);
router.post('/clients/:id/apply-coupon', applyManualCoupon);
router.delete('/clients/:id/data', deleteClientData);

// Services Management (Admin)
router.get('/services', getAdminServices);
router.get('/promotions', getAdminPromotions);
router.delete('/promotions/:id', deletePromotion);
router.put('/promotions/:id', updatePromotionStatus);
router.patch('/services/:id/staff-pick', toggleStaffPick);
router.patch('/services/:id/moderation', moderateService);

// Promotion Tiers Management (Admin)
router.get('/promotion-tiers', getPromotionTiers);
router.post('/promotion-tiers', createPromotionTier);
router.put('/promotion-tiers/:id', updatePromotionTier);
router.delete('/promotion-tiers/:id', deletePromotionTier);

// ===== IMPERSONATE USER (Admin Only) =====
// POST /api/admin/impersonate/:userId
// Generates a JWT for the target user, allowing admin to act as them
router.post('/impersonate/:userId', async (req, res) => {
    try {
        const { pool } = await import('../config/db.js');
        const jwt = await import('jsonwebtoken');

        const adminId = req.user.id;
        const targetUserId = req.params.userId;

        // 1. Fetch target user
        const userRes = await pool.query(
            'SELECT id, email, role FROM users WHERE id = $1',
            [targetUserId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Usuario no encontrado'
            });
        }

        const targetUser = userRes.rows[0];

        // 2. Security: Prevent impersonating other admins
        if (targetUser.role === 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'No se puede impersonar a otro administrador'
            });
        }

        // 3. Generate impersonation token (shorter expiry for security)
        const JWT_SECRET = process.env.JWT_SECRET; // Validated at startup by auth.js
        const token = jwt.default.sign(
            {
                id: targetUser.id,
                role: targetUser.role,
                email: targetUser.email,
                impersonatedBy: adminId // Track who is impersonating
            },
            JWT_SECRET,
            { expiresIn: '2h' } // Shorter expiry for impersonation sessions
        );

        // 4. Log the impersonation action (audit trail)
        console.log(`[AUDIT] Admin ${adminId} impersonated user ${targetUserId} (${targetUser.email}) at ${new Date().toISOString()}`);

        // 5. Return token and user info
        res.json({
            status: 'success',
            message: `Ahora estás actuando como ${targetUser.email}`,
            token,
            user: {
                id: targetUser.id,
                email: targetUser.email,
                role: targetUser.role
            }
        });

    } catch (err) {
        console.error('Impersonate error:', err);
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
});


export default router;
