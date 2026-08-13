import express from 'express';
import {
    createService, getServices, getFeaturedServices, getServiceById, getMyServices, updateService,
    createPromotion, getActivePromotionTiers
} from '../controllers/serviceController.js';
import { authenticateToken, requireVerified } from '../middleware/sessionAuth.js';
import { requireRole } from '../middleware/authorization.js';
import { getServiceQuote } from '../controllers/publicServiceQuoteController.js';
import videoUpload from '../middleware/videoUpload.js';
import upload from '../middleware/upload.js';
import { cleanupRejectedUploads, validateUploadedFileFields, validateUploadedFileSignatures } from '../middleware/fileUploadSecurity.js';
import { serviceMediaUploadLimiter, serviceVideoUploadLimiter } from '../middleware/uploadRateLimits.js';

import { checkCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

const validateCoverUpload = validateUploadedFileFields({ allowedFields: ['cover'], maxFiles: 1 });
const validateVideoUpload = validateUploadedFileFields({ allowedFields: ['video'], maxFiles: 1 });

// Public Routes
// Cache for 10 minutes (600s)
router.get('/featured', checkCache(600), getFeaturedServices);
router.get('/', checkCache(600), getServices);

// Promotion Tiers (Public for providers to see options)
router.get('/promotion-tiers', getActivePromotionTiers);

// Protected Routes (Provider Only)
// CRITICAL: Must be defined BEFORE /:id because "my-services" would match the /:id wildcard!
router.get('/my-services', authenticateToken, requireRole('provider'), getMyServices);
router.post('/', authenticateToken, requireRole('provider'), requireVerified, createService);
router.put('/:id', authenticateToken, requireRole('provider'), requireVerified, updateService);

// Video Upload Endpoint (50MB max)
router.post('/upload-video', authenticateToken, requireRole('provider', 'admin'), requireVerified, serviceVideoUploadLimiter, cleanupRejectedUploads, videoUpload.single('video'), validateVideoUpload, validateUploadedFileSignatures, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No se recibió ningún video.' });
        }

        // Return the URL path to the uploaded video
        const videoUrl = `/uploads/${req.file.filename}`;

        res.json({
            status: 'success',
            message: 'Video subido exitosamente',
            videoUrl: videoUrl,
            filename: req.file.filename,
            size: req.file.size
        });
    } catch (err) {
        console.error('Video upload error:', err);
        res.status(500).json({ status: 'error', message: 'Error al subir el video.' });
    }
});

// Cover Image Upload Endpoint (5MB max, JPG/PNG/WEBP)
router.post('/upload-cover', authenticateToken, requireRole('provider', 'admin'), requireVerified, serviceMediaUploadLimiter, cleanupRejectedUploads, upload.single('cover'), validateCoverUpload, validateUploadedFileSignatures, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No se recibió ninguna imagen.' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        res.json({
            status: 'success',
            message: 'Imagen de portada subida exitosamente',
            imageUrl: imageUrl,
            filename: req.file.filename,
            size: req.file.size
        });
    } catch (err) {
        console.error('Cover image upload error:', err);
        res.status(500).json({ status: 'error', message: 'Error al subir la imagen.' });
    }
});

// Public Route with Parameter
router.get('/:id/quote', getServiceQuote);
router.get('/:id', getServiceById);

// Promotions
router.post('/promotions', authenticateToken, requireRole('provider'), requireVerified, createPromotion);

export default router;
