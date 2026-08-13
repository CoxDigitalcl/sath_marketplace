import express from 'express';
import { updateProfile, getProfile, getDashboardStats, getFinanceDetails, getProviderKycRequirements } from '../controllers/providerController.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorization.js';
import upload from '../middleware/upload.js';
import { cleanupRejectedUploads, validateUploadedFileFields, validateUploadedFileSignatures } from '../middleware/fileUploadSecurity.js';
import { providerProfileUploadLimiter } from '../middleware/uploadRateLimits.js';

const router = express.Router();

const validateProviderProfileUpload = validateUploadedFileFields({
    allowedFields: ['profile_image', 'banner_image'],
    allowedPrefixes: ['kyc_'],
    allowedBodyFields: [
        'full_name',
        'phone',
        'bio',
        'store_name',
        'contact_email',
        'public_phone',
        'public_website',
        'instagram_handle',
        'bank_data',
        'coverage_region_code',
        'coverage_communes'
    ],
    maxFilesPerField: 1,
    maxFiles: 12
});

// Get Profile
router.get('/profile', authenticateToken, requireRole('provider'), getProfile);
router.get('/dashboard-stats', authenticateToken, requireRole('provider'), getDashboardStats);
// Get Finance Details
router.get('/finance', authenticateToken, requireRole('provider'), requireVerified, getFinanceDetails);

// Get KYC Requirements (dynamic from DB)
router.get('/kyc-requirements', authenticateToken, requireRole('provider'), getProviderKycRequirements);

// Update Profile & Upload KYC
// Now uses upload.any() to dynamically accept any KYC field defined in verification_requirements
router.post('/profile',
    authenticateToken,
    requireRole('provider'),
    providerProfileUploadLimiter,
    cleanupRejectedUploads,
    upload.any(),
    validateProviderProfileUpload,
    validateUploadedFileSignatures,
    updateProfile
);

export default router;
