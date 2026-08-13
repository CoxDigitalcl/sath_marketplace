import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getApplicationOrigin, getCorsOrigins } from '../config/application.js';
import { createCorsOptions } from '../middleware/security.js';
import { createHttpsRedirectMiddleware } from '../middleware/httpsRedirect.js';
import { migratePrivateUploads } from '../scripts/migrate_private_uploads.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

const evaluateCorsOrigin = (options, origin) => new Promise((resolve, reject) => {
    options.origin(origin, (error, allowed) => {
        if (error) return reject(error);
        return resolve(allowed);
    });
});

test('production origin config fails closed away from localhost and invalid URLs', async () => {
    const environment = {
        NODE_ENV: 'production',
        APP_URL: 'https://serviciosatuhogar.cl/path-is-ignored',
        CORS_ORIGIN: 'http://localhost:3000,not-a-url'
    };

    assert.equal(getApplicationOrigin(environment), 'https://serviciosatuhogar.cl');
    assert.deepEqual(getCorsOrigins(environment), ['https://serviciosatuhogar.cl']);

    const options = createCorsOptions(environment);
    assert.equal(await evaluateCorsOrigin(options, undefined), true);
    assert.equal(await evaluateCorsOrigin(options, 'https://serviciosatuhogar.cl'), true);
    assert.equal(await evaluateCorsOrigin(options, 'http://localhost:3000'), false);
    assert.equal(await evaluateCorsOrigin(options, 'https://evil.example'), false);
});

test('HTTPS redirect preserves the request path but never trusts the Host header', () => {
    const middleware = createHttpsRedirectMiddleware({
        NODE_ENV: 'production',
        APP_URL: 'https://serviciosatuhogar.cl'
    });
    const redirects = [];
    const response = { redirect: (status, location) => redirects.push({ status, location }) };
    const request = {
        secure: false,
        originalUrl: '//evil.example/login?next=/admin',
        get: (name) => name === 'x-forwarded-proto' ? 'http' : 'evil.example'
    };

    middleware(request, response, () => assert.fail('plaintext production request must not continue'));
    assert.deepEqual(redirects, [{
        status: 308,
        location: 'https://serviciosatuhogar.cl/evil.example/login?next=/admin'
    }]);
});

test('HTTPS and non-production requests continue without redirect', () => {
    let continued = 0;
    const response = { redirect: () => assert.fail('request must not redirect') };
    const secureRequest = { secure: false, originalUrl: '/', get: () => 'https' };
    const localRequest = { secure: false, originalUrl: '/', get: () => 'http' };

    createHttpsRedirectMiddleware({ NODE_ENV: 'production' })(secureRequest, response, () => { continued += 1; });
    createHttpsRedirectMiddleware({ NODE_ENV: 'development' })(localRequest, response, () => { continued += 1; });
    assert.equal(continued, 2);
});

test('HTTP migration, repair and debug routes are retired', async () => {
    const [adminRoutes, notificationRoutes, index] = await Promise.all([
        read('server/routes/adminRoute.js'),
        read('server/routes/notificationRoute.js'),
        read('server/index.js')
    ]);

    assert.doesNotMatch(adminRoutes, /router\.(?:get|post|delete)\('\/(?:migrations|db-migrate|debug|fix-favorites)/);
    assert.doesNotMatch(notificationRoutes, /router\.get\('\/migration'/);
    assert.doesNotMatch(index, /ENABLE_MAINTENANCE_ROUTES/);
    assert.doesNotMatch(index, /app\.get\('\/api\/(?:test-db|setup-schema)'/);
});

test('private upload migration is dry-run by default, atomic per file and idempotent', async (t) => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sath-private-uploads-'));
    const sourceDir = path.join(temporaryRoot, 'uploads');
    const destinationDir = path.join(temporaryRoot, 'private_uploads');
    await fs.mkdir(sourceDir);
    await fs.mkdir(destinationDir);
    await fs.writeFile(path.join(sourceDir, 'kyc_id_front-1.pdf'), '%PDF-private');
    await fs.writeFile(path.join(sourceDir, 'profile_image-1.webp'), 'public');
    await fs.writeFile(path.join(destinationDir, 'existing-private.pdf'), '%PDF-existing');
    t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

    const dryRun = await migratePrivateUploads({ sourceDir, destinationDir });
    assert.deepEqual(dryRun, { mode: 'dry-run', candidates: 1, moved: 0, hardened: 0 });
    await fs.access(path.join(sourceDir, 'kyc_id_front-1.pdf'));

    const applied = await migratePrivateUploads({ sourceDir, destinationDir, apply: true });
    assert.deepEqual(applied, { mode: 'apply', candidates: 1, moved: 1, hardened: 1 });
    await assert.rejects(fs.access(path.join(sourceDir, 'kyc_id_front-1.pdf')));
    await fs.access(path.join(destinationDir, 'kyc_id_front-1.pdf'));
    await fs.access(path.join(sourceDir, 'profile_image-1.webp'));

    const repeated = await migratePrivateUploads({ sourceDir, destinationDir, apply: true });
    assert.deepEqual(repeated, { mode: 'apply', candidates: 0, moved: 0, hardened: 2 });

    if (process.platform !== 'win32') {
        const directoryMode = (await fs.stat(destinationDir)).mode & 0o777;
        const fileMode = (await fs.stat(path.join(destinationDir, 'kyc_id_front-1.pdf'))).mode & 0o777;
        assert.equal(directoryMode, 0o700);
        assert.equal(fileMode, 0o600);
    }
});
