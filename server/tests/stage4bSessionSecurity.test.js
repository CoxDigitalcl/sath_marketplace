import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    createAccessToken,
    createAdminStepUpToken,
    hasCurrentTokenVersion,
    verifyAccessToken,
    verifyAdminStepUpToken
} from '../services/sessionSecurity.js';
import { createRequestContextMiddleware } from '../middleware/requestContext.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');
const TEST_SECRET = 'stage4b-test-secret-that-is-long-enough';

test('access tokens are typed, short-lived and bound to the current token version', () => {
    const token = createAccessToken({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.test',
        role: 'client',
        token_version: 7
    }, { secret: TEST_SECRET, expiresIn: '2h' });
    const claims = verifyAccessToken(token, { secret: TEST_SECRET });

    assert.equal(claims.tokenType, 'access');
    assert.equal(claims.tokenVersion, 7);
    assert.ok(claims.exp - claims.iat <= 2 * 60 * 60);
    assert.equal(hasCurrentTokenVersion(claims, { token_version: 7 }), true);
    assert.equal(hasCurrentTokenVersion(claims, { token_version: 8 }), false);
    assert.equal(hasCurrentTokenVersion({ ...claims, tokenVersion: undefined }, { token_version: 0 }), false);
});

test('admin step-up tokens cannot be substituted with ordinary access tokens', () => {
    const admin = {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'admin@example.test',
        role: 'admin',
        token_version: 3
    };
    const stepUp = createAdminStepUpToken(admin, { secret: TEST_SECRET });
    const claims = verifyAdminStepUpToken(stepUp, { secret: TEST_SECRET });
    assert.equal(claims.purpose, 'admin_step_up');
    assert.equal(claims.tokenVersion, 3);
    assert.ok(claims.exp - claims.iat <= 5 * 60);

    const access = createAccessToken(admin, { secret: TEST_SECRET });
    assert.throws(() => verifyAdminStepUpToken(access, { secret: TEST_SECRET }));
});

test('request context accepts bounded IDs and never reflects attacker-controlled values', () => {
    const middleware = createRequestContextMiddleware({ randomUUID: () => '33333333-3333-4333-8333-333333333333' });
    const responseHeaders = {};
    const req = { get: () => 'bad id\r\nx-injected: yes' };
    const res = { set: (name, value) => { responseHeaders[name] = value; } };
    middleware(req, res, () => {});

    assert.equal(req.correlationId, '33333333-3333-4333-8333-333333333333');
    assert.equal(responseHeaders['X-Request-ID'], req.correlationId);
});

test('session migration provides revocation, one-use reset storage, audit trail and automatic invalidation', async () => {
    const migration = await read('server/scripts/migrations/add_session_security.sql');
    assert.match(migration, /ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS password_reset_sessions/);
    assert.match(migration, /token_hash CHAR\(64\) NOT NULL UNIQUE/);
    assert.match(migration, /consumed_at TIMESTAMP WITH TIME ZONE/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_security_events/);
    assert.match(migration, /CREATE TRIGGER users_security_version_trigger/);
});

test('password and admin security controllers use atomic one-use and audited flows', async () => {
    const [passwords, admin, adminRoutes, authRoutes] = await Promise.all([
        read('server/controllers/passwordSecurityController.js'),
        read('server/controllers/adminSecurityController.js'),
        read('server/routes/adminRoute.js'),
        read('server/routes/authRoute.js')
    ]);

    assert.match(passwords, /UPDATE password_reset_sessions[\s\S]*consumed_at = NOW\(\)[\s\S]*consumed_at IS NULL/);
    assert.match(passwords, /UPDATE users[\s\S]*password_hash[\s\S]*FROM consumed/);
    assert.doesNotMatch(passwords, /jwt\.sign|resetLink|Math\.random/);
    assert.doesNotMatch(admin, /resetLink|data:\s*\{\s*token|expiresIn:\s*'2h'/);
    assert.match(admin, /expiresIn:\s*'15m'/);
    assert.match(admin, /recordAdminSecurityEvent/);
    assert.match(adminRoutes, /force-reset-password', requireAdminStepUp, forcePasswordReset/);
    assert.match(adminRoutes, /impersonate\/:userId', requireAdminStepUp, impersonateUser/);
    assert.match(authRoutes, /router\.post\('\/step-up'[\s\S]*createAdminStepUp/);
    assert.match(authRoutes, /router\.post\('\/logout'[\s\S]*logout/);
});

test('production errors and logs use correlation IDs without query strings or internal details', async () => {
    const [index, errors, performance, metrics] = await Promise.all([
        read('server/index.js'),
        read('server/middleware/errorHandler.js'),
        read('server/middleware/performanceLogger.js'),
        read('server/services/systemMetricService.js')
    ]);

    assert.match(index, /createRequestContextMiddleware/);
    assert.doesNotMatch(index, /logger\.info\(`\$\{req\.method\} \$\{req\.url\}/);
    assert.match(errors, /INTERNAL_SERVER_ERROR/);
    assert.match(errors, /correlationId/);
    assert.doesNotMatch(errors, /message:\s*err\.message/);
    assert.doesNotMatch(errors, /req\.originalUrl/);
    assert.doesNotMatch(performance, /req\.originalUrl/);
    assert.doesNotMatch(metrics, /req\?\.originalUrl/);
});

test('browser session no longer persists auth credentials in localStorage and impersonation is visible', async () => {
    const sourceFiles = [
        'src/stores/authStore.ts',
        'src/api/client.ts',
        'src/components/admin/AdminDashboard.tsx',
        'src/components/admin/views/ClientProfile.tsx',
        'src/components/admin/provider-management/ProviderTable.tsx',
        'src/components/common/ImpersonationBanner.tsx',
        'src/api/adminSecurity.ts',
        'src/App.tsx'
    ];
    const sources = (await Promise.all(sourceFiles.map(read))).join('\n');

    assert.doesNotMatch(sources, /localStorage\.(?:getItem|setItem|removeItem)\(['"](?:auth_token|auth-storage|token|adminToken)/);
    assert.match(sources, /requestAdminStepUp/);
    assert.match(sources, /ImpersonationBanner/);
    assert.match(sources, /sessionStorage/);
    assert.doesNotMatch(sources, /window\.prompt/);
    assert.match(sources, /type="password"/);
    assert.match(sources, /beginImpersonation/);
    assert.match(sources, /returnToAdmin/);
});
