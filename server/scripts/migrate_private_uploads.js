import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateUploadDir, uploadDir } from '../config/uploadPaths.js';

export const PROTECTED_UPLOAD_FILENAME = /^(kyc_|attachment-|file-)/i;

const listRegularFiles = async (directory) => {
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        return entries.filter(entry => entry.isFile()).map(entry => entry.name);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

export const migratePrivateUploads = async ({
    sourceDir = uploadDir,
    destinationDir = privateUploadDir,
    apply = false
} = {}) => {
    const sourceFiles = await listRegularFiles(sourceDir);
    const protectedFiles = sourceFiles.filter(name => PROTECTED_UPLOAD_FILENAME.test(name));
    const destinationFiles = new Set(await listRegularFiles(destinationDir));
    const conflicts = protectedFiles.filter(name => destinationFiles.has(name));

    if (conflicts.length > 0) {
        throw new Error(`Private upload migration stopped: ${conflicts.length} destination conflict(s).`);
    }

    if (!apply) {
        return { mode: 'dry-run', candidates: protectedFiles.length, moved: 0, hardened: 0 };
    }

    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(destinationDir, { recursive: true });

    await fs.chmod(sourceDir, 0o755);
    await fs.chmod(destinationDir, 0o700);

    let hardened = 0;
    for (const name of destinationFiles) {
        await fs.chmod(path.join(destinationDir, name), 0o600);
        hardened += 1;
    }

    let moved = 0;
    for (const name of protectedFiles) {
        const sourcePath = path.join(sourceDir, name);
        const destinationPath = path.join(destinationDir, name);
        await fs.rename(sourcePath, destinationPath);
        await fs.chmod(destinationPath, 0o600);
        moved += 1;
    }

    return { mode: 'apply', candidates: protectedFiles.length, moved, hardened };
};

const isDirectExecution = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
    try {
        const result = await migratePrivateUploads({ apply: process.argv.includes('--apply') });
        console.log(JSON.stringify(result));
        if (result.mode === 'dry-run') {
            console.log('Dry run only. Re-run with --apply after reviewing the candidate count.');
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
