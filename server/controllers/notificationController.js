import { pool } from '../config/db.js';
import logger from '../config/logger.js';

// ==================== MIGRATION ====================
export const runNotificationMigration = async (req, res, next) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'info',
                link VARCHAR(512),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
            CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at DESC);
        `);

        res.json({ status: 'success', message: 'Notifications table created successfully.' });
    } catch (err) {
        logger.error(`[NOTIFICATION_MIGRATION] Error: ${err.message}`);
        next(err);
    }
};

// ==================== GET NOTIFICATIONS ====================
// Returns the latest 30 notifications + unread count
export const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Get unread count
        const countResult = await pool.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );

        // Get latest 30 notifications
        const notificationsResult = await pool.query(
            `SELECT id, title, message, type, link, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 30`,
            [userId]
        );

        res.json({
            status: 'success',
            unreadCount: parseInt(countResult.rows[0].unread_count, 10),
            notifications: notificationsResult.rows
        });
    } catch (err) {
        logger.error(`[GET_NOTIFICATIONS] Error: ${err.message}`);
        next(err);
    }
};

// ==================== UNREAD COUNT ONLY (lightweight for polling) ====================
export const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({
            status: 'success',
            unreadCount: parseInt(result.rows[0].unread_count, 10)
        });
    } catch (err) {
        logger.error(`[UNREAD_COUNT] Error: ${err.message}`);
        next(err);
    }
};

// ==================== MARK ONE AS READ ====================
export const markAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        res.json({ status: 'success' });
    } catch (err) {
        logger.error(`[MARK_READ] Error: ${err.message}`);
        next(err);
    }
};

// ==================== MARK ALL AS READ ====================
export const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );

        res.json({ status: 'success' });
    } catch (err) {
        logger.error(`[MARK_ALL_READ] Error: ${err.message}`);
        next(err);
    }
};

// ==================== HELPER: Create In-App Notification ====================
// This is imported and called by other controllers (not an HTTP handler)
export const createInAppNotification = async ({ userId, title, message, type = 'info', link = null }) => {
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, title, message, type, link]
        );
        logger.info(`[NOTIFICATION] Created for user ${userId}: ${title}`);
        return true;
    } catch (err) {
        // Log but don't throw — notifications should never crash the main flow
        logger.error(`[NOTIFICATION] Failed to create for user ${userId}: ${err.message}`);
        return false;
    }
};

// ==================== HELPER: Notify all admins ====================
export const notifyAllAdmins = async ({ title, message, type = 'warning', link = null }) => {
    try {
        const adminsResult = await pool.query("SELECT id FROM users WHERE role = 'admin'");
        for (const admin of adminsResult.rows) {
            await createInAppNotification({ userId: admin.id, title, message, type, link });
        }
    } catch (err) {
        logger.error(`[NOTIFY_ADMINS] Failed: ${err.message}`);
    }
};
