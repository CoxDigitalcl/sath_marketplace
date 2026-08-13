import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('claim and support attachments share quota, cleanup and signature validation', () => {
    const claims = read('server/routes/claimsRoute.js');
    const support = read('server/routes/supportRoute.js');

    assert.match(claims, /privateAttachmentUploadLimiter, cleanupRejectedUploads, upload\.single\('attachment'\), validateUploadedFileSignatures/);
    assert.match(support, /privateAttachmentUploadLimiter, cleanupRejectedUploads, upload\.single\('file'\), validateUploadedFileSignatures/);
});
