import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadDir = path.join(__dirname, '../../uploads');
export const privateUploadDir = path.join(__dirname, '../../private_uploads');
