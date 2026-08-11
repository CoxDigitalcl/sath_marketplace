import multer from 'multer';
import { cleanupUploadedFiles } from './fileUploadSecurity.js';

export const handleUploadError = async (err, req, res, next) => {
    const isMulterError = err instanceof multer.MulterError;
    const isRejectedType = err?.message === 'Invalid file type.';

    if (!isMulterError && !isRejectedType) {
        return next(err);
    }

    try {
        await cleanupUploadedFiles(req);
    } catch {
        // The request must still fail closed even if best-effort cleanup fails.
    }

    const tooLarge = isMulterError && err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
        status: 'error',
        message: tooLarge
            ? 'El archivo excede el tamano maximo permitido.'
            : 'La carga contiene un archivo o campo no permitido.',
        code: tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD'
    });
};
