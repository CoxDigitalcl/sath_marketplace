import multer from 'multer';
import fs from 'fs';
import { privateUploadDir, uploadDir } from '../config/uploadPaths.js';

// Ensure directory exists (locally mostly, on server user must create it manually to be safe)
for (const dir of [uploadDir, privateUploadDir]) {
    if (!fs.existsSync(dir)) {
        // We attempt to create it, but on cPanel this might fail if permissions are strict
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            console.error('Could not create upload directory automatically:', e.message);
        }
    }
}

try {
    fs.chmodSync(uploadDir, 0o755);
    fs.chmodSync(privateUploadDir, 0o700);
} catch (error) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error(`Could not harden upload directory permissions: ${error.message}`);
    }
    console.error('Could not harden upload directory permissions:', error.message);
}

export const isPrivateField = (fieldname = '') => (
    fieldname.startsWith('kyc_') ||
    fieldname === 'file' ||
    fieldname === 'attachment'
);

const MIME_MAP = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, isPrivateField(file.fieldname) ? privateUploadDir : uploadDir);
    },
    filename: (req, file, cb) => {
        // Unique filename: timestamp-random-safeExtension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = MIME_MAP[file.mimetype] || '.bin';
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    },
});

// Filter for images and PDFs
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 12
    },
    fileFilter: fileFilter
});

export default upload;
