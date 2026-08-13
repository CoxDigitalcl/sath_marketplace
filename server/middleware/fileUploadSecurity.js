import fs from 'fs/promises';
import path from 'node:path';
import { privateUploadDir } from '../config/uploadPaths.js';

const SIGNATURE_BYTES = 16;
const RESOLVED_PRIVATE_UPLOAD_DIR = path.resolve(privateUploadDir);
const isPrivateUpload = (filePath) => path.dirname(path.resolve(filePath)) === RESOLVED_PRIVATE_UPLOAD_DIR;

const startsWith = (buffer, bytes) => (
    buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)
);

const asciiAt = (buffer, offset, value) => (
    buffer.length >= offset + value.length && buffer.subarray(offset, offset + value.length).toString('ascii') === value
);

export const matchesDeclaredFileType = (mimetype, buffer) => {
    if (!Buffer.isBuffer(buffer)) return false;

    switch (mimetype) {
        case 'image/jpeg':
            return startsWith(buffer, [0xff, 0xd8, 0xff]);
        case 'image/png':
            return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/webp':
            return asciiAt(buffer, 0, 'RIFF') && asciiAt(buffer, 8, 'WEBP');
        case 'application/pdf':
            return asciiAt(buffer, 0, '%PDF-');
        case 'video/mp4':
        case 'video/quicktime':
            return asciiAt(buffer, 4, 'ftyp');
        case 'video/ogg':
            return asciiAt(buffer, 0, 'OggS');
        case 'video/x-msvideo':
            return asciiAt(buffer, 0, 'RIFF') && asciiAt(buffer, 8, 'AVI ');
        case 'video/webm':
        case 'video/x-matroska':
            return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
        default:
            return false;
    }
};

export const getUploadedFiles = (req) => {
    if (req.file) return [req.file];
    if (Array.isArray(req.files)) return req.files;
    if (req.files && typeof req.files === 'object') return Object.values(req.files).flat();
    return [];
};

export const cleanupUploadedFiles = async (req) => {
    const files = getUploadedFiles(req);
    await Promise.all(files.map(async (file) => {
        if (!file?.path) return;
        try {
            await fs.unlink(file.path);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
    }));
};

const readSignature = async (filePath) => {
    const handle = await fs.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(SIGNATURE_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, SIGNATURE_BYTES, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
};

export const validateUploadedFileSignatures = async (req, res, next) => {
    const files = getUploadedFiles(req);

    try {
        for (const file of files) {
            const signature = await readSignature(file.path);
            if (!matchesDeclaredFileType(file.mimetype, signature)) {
                await cleanupUploadedFiles(req);
                return res.status(400).json({
                    status: 'error',
                    message: 'El contenido del archivo no coincide con un formato permitido.',
                    code: 'INVALID_FILE_CONTENT'
                });
            }
            if (isPrivateUpload(file.path)) {
                await fs.chmod(file.path, 0o600);
            }
        }

        return next();
    } catch (err) {
        try {
            await cleanupUploadedFiles(req);
        } catch {
            // Preserve the original validation/read error for the central error handler.
        }
        return next(err);
    }
};

export const isAllowedUploadField = (fieldname, { allowedFields = [], allowedPrefixes = [] } = {}) => (
    allowedFields.includes(fieldname) || allowedPrefixes.some(prefix => fieldname.startsWith(prefix))
);

export const validateUploadedFileFields = ({
    allowedFields = [],
    allowedPrefixes = [],
    allowedBodyFields = [],
    maxFilesPerField = 1,
    maxFiles = 10
} = {}) => (req, res, next) => {
    const files = getUploadedFiles(req);
    const counts = new Map();
    const invalidFileField = files.find(file => {
        if (!isAllowedUploadField(file.fieldname, { allowedFields, allowedPrefixes })) return true;
        const count = (counts.get(file.fieldname) || 0) + 1;
        counts.set(file.fieldname, count);
        return count > maxFilesPerField;
    });

    const allowedBody = new Set(allowedBodyFields);
    const invalidBodyField = Object.keys(req.body || {}).find(field => !allowedBody.has(field));

    if (invalidFileField || invalidBodyField || files.length > maxFiles) {
        return res.status(400).json({
            status: 'error',
            message: 'La solicitud contiene campos de carga no permitidos.',
            code: 'INVALID_UPLOAD_FIELD'
        });
    }

    return next();
};

/**
 * Multer writes before controllers run. Remove files automatically when a later
 * validator/controller rejects the request so invalid uploads do not consume disk.
 */
export const cleanupRejectedUploads = (req, res, next) => {
    let cleaned = false;
    const cleanupIfRejected = () => {
        if (!cleaned && res.statusCode >= 400) {
            cleaned = true;
            cleanupUploadedFiles(req).catch(() => {});
        }
    };

    res.once('finish', cleanupIfRejected);
    res.once('close', cleanupIfRejected);
    return next();
};
