import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateUploadsPath = path.join(__dirname, '../../private_uploads');
const publicUploadsPath = path.join(__dirname, '../../uploads');

const isSafeFilename = (filename) => /^[a-z0-9_.-]+$/i.test(filename);

const getCandidatePath = (filename) => {
    const privatePath = path.join(privateUploadsPath, filename);
    if (fs.existsSync(privatePath)) return privatePath;

    const legacyPublicPath = path.join(publicUploadsPath, filename);
    if (fs.existsSync(legacyPublicPath)) return legacyPublicPath;

    return null;
};

const userCanAccessFile = async (filename, user) => {
    if (user.role === 'admin') {
        const referenced = await pool.query(`
            SELECT 1
            WHERE EXISTS (
                SELECT 1 FROM provider_profiles WHERE kyc_documents::text ILIKE $1
            )
            OR EXISTS (
                SELECT 1 FROM ticket_messages WHERE attachment_url ILIKE $1
            )
            OR EXISTS (
                SELECT 1 FROM claims WHERE attachment_url ILIKE $1
            )
            OR EXISTS (
                SELECT 1 FROM claim_messages WHERE attachment_url ILIKE $1
            )
        `, [`%${filename}%`]);
        return referenced.rows.length > 0;
    }

    const access = await pool.query(`
        SELECT 1
        WHERE EXISTS (
            SELECT 1
            FROM provider_profiles
            WHERE user_id = $2 AND kyc_documents::text ILIKE $1
        )
        OR EXISTS (
            SELECT 1
            FROM ticket_messages tm
            JOIN support_tickets st ON tm.ticket_id = st.id
            WHERE tm.attachment_url ILIKE $1
              AND (st.user_id = $2 OR st.target_user_id = $2)
        )
        OR EXISTS (
            SELECT 1
            FROM claims c
            WHERE c.attachment_url ILIKE $1
              AND c.user_id = $2
        )
        OR EXISTS (
            SELECT 1
            FROM claim_messages cm
            JOIN claims c ON cm.claim_id = c.id
            WHERE cm.attachment_url ILIKE $1
              AND c.user_id = $2
        )
    `, [`%${filename}%`, user.id]);

    return access.rows.length > 0;
};

export const getPrivateFile = async (req, res, next) => {
    try {
        const filename = path.basename(req.params.filename || '');
        if (!filename || !isSafeFilename(filename)) {
            return res.status(404).json({ status: 'error', message: 'File not found' });
        }

        const canAccess = await userCanAccessFile(filename, req.user);
        if (!canAccess) {
            return res.status(404).json({ status: 'error', message: 'File not found' });
        }

        const filePath = getCandidatePath(filename);
        if (!filePath) {
            return res.status(404).json({ status: 'error', message: 'File not found' });
        }

        return res.sendFile(filePath);
    } catch (err) {
        logger.error(`[PrivateFiles] ${err.message}`);
        next(err);
    }
};
