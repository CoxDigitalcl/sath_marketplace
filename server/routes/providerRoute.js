import express from 'express';
import { updateProfile, getProfile, getDashboardStats, getFinanceDetails, getProviderKycRequirements } from '../controllers/providerController.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Get Profile
router.get('/profile', authenticateToken, getProfile);
router.get('/dashboard-stats', authenticateToken, getDashboardStats);
// Get Finance Details
router.get('/finance', authenticateToken, requireVerified, getFinanceDetails);

// Get KYC Requirements (dynamic from DB)
router.get('/kyc-requirements', authenticateToken, getProviderKycRequirements);

// Update Profile & Upload KYC
// Now uses upload.any() to dynamically accept any KYC field defined in verification_requirements
router.post('/profile',
    authenticateToken,
    upload.any(),
    updateProfile
);

export default router;
