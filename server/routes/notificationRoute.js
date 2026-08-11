import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    runNotificationMigration
} from '../controllers/notificationController.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ status: 'error', message: 'Admin access required' });
};

const requireMaintenanceMode = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_MAINTENANCE_ROUTES === 'true') return next();
    return res.status(404).json({ status: 'error', message: 'Not found' });
};

// Migration (admin-only; production requires ENABLE_MAINTENANCE_ROUTES=true)
router.get('/migration', authenticateToken, requireAdmin, requireMaintenanceMode, runNotificationMigration);

// All other routes require authentication
router.get('/', authenticateToken, getNotifications);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.patch('/:id/read', authenticateToken, markAsRead);
router.patch('/read-all', authenticateToken, markAllAsRead);

export default router;
