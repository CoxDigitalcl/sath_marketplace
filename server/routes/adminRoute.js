
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
    applyManualCoupon,
    getDashboardCharts,
} from '../controllers/adminController.js';

import { getProviderDetails, getProviderServices, updateDocumentStatus, togglePayouts } from '../controllers/providerController.js';
import { getAdminServices, getAdminPromotions, toggleStaffPick, moderateService, deletePromotion, updatePromotionStatus } from '../controllers/serviceController.js';
import {
    createServiceRevisionDecision,
    getServiceRevisionDetail,
    getServiceRevisionQueue,
} from '../controllers/serviceRevisionController.js';
import { blockClient, forcePasswordReset, deleteClientData, impersonateUser } from '../controllers/adminSecurityController.js';
import { requireAdminStepUp } from '../middleware/adminStepUp.js';
import { authenticateToken } from '../middleware/sessionAuth.js';

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
router.put('/clients/:id/block', requireAdminStepUp, blockClient);
router.post('/clients/:id/force-reset-password', requireAdminStepUp, forcePasswordReset);
router.post('/clients/:id/apply-coupon', applyManualCoupon);
router.delete('/clients/:id/data', requireAdminStepUp, deleteClientData);

// Services Management (Admin)
router.get('/services', getAdminServices);
router.get('/promotions', getAdminPromotions);
router.delete('/promotions/:id', deletePromotion);
router.put('/promotions/:id', updatePromotionStatus);
router.patch('/services/:id/staff-pick', toggleStaffPick);
router.patch('/services/:id/moderation', moderateService);
router.get('/service-revisions', getServiceRevisionQueue);
router.get('/service-revisions/:revisionId', getServiceRevisionDetail);
router.post('/service-revisions/:revisionId/decisions', createServiceRevisionDecision);

// Promotion Tiers Management (Admin)
router.get('/promotion-tiers', getPromotionTiers);
router.post('/promotion-tiers', createPromotionTier);
router.put('/promotion-tiers/:id', updatePromotionTier);
router.delete('/promotion-tiers/:id', deletePromotionTier);

// Critical support access: short-lived, step-up protected and audited in the controller.
router.post('/impersonate/:userId', requireAdminStepUp, impersonateUser);

export default router;
