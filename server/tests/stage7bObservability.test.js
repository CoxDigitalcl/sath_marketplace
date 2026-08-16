import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApplicationLogger } from '../config/logger.js';
import { createAlertService, SEVERITY } from '../services/alertService.js';
import { collectOperationalSnapshot } from '../services/operationalSnapshotService.js';
import {
    classifyUserAgent,
    normalizeRoutePath,
} from '../services/requestObservability.js';
import { createMetricStore } from '../services/systemMetricService.js';

test('normalizes dynamic routes and classifies crawler families without retaining raw user-agents', () => {
    assert.equal(
        normalizeRoutePath('/api/bookings/71b7b28e-6783-441e-a16d-2c6789d5987d/status?token=secret'),
        '/api/bookings/:id/status'
    );
    assert.equal(normalizeRoutePath('/service/gasfiteria-71b7b28e-6783-441e-a16d-2c6789d5987d'), '/service/:slug');
    assert.equal(normalizeRoutePath('/categories/clases'), '/categories/:slug');

    assert.equal(classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), 'googlebot');
    assert.equal(classifyUserAgent('Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0.0.0'), 'browser-chromium');
    assert.equal(classifyUserAgent('ChatGPT-User/1.0'), 'openai-agent');
    assert.equal(classifyUserAgent('ClaudeBot/1.0'), 'anthropic-crawler');
    assert.equal(classifyUserAgent('curl/8.0'), 'other');
});

test('aggregates request percentiles, status rates, routes and crawler families in a bounded window', () => {
    const metrics = createMetricStore({ maxRequests: 5, maxErrors: 2, now: () => new Date('2026-08-16T03:00:00.000Z') });
    const samples = [
        [10, 200, '/api/health', 'browser-chromium'],
        [20, 200, '/api/health', 'googlebot'],
        [30, 404, '/service/:slug', 'browser-chromium'],
        [40, 429, '/api/auth/login', 'other'],
        [1000, 500, '/api/bookings/:id', 'openai-agent'],
    ];

    for (const [durationMs, statusCode, route, userAgentFamily] of samples) {
        metrics.recordRequest({ durationMs, statusCode, route, method: 'GET', userAgentFamily });
    }
    metrics.recordError(new Error('must not be retained'), {
        path: '/api/bookings/secret-booking-id',
        method: 'GET',
        correlationId: 'request-safe-1234',
    });

    const stats = metrics.getStats();
    assert.deepEqual(stats.latencyMs, { average: 220, p50: 30, p95: 1000, p99: 1000 });
    assert.deepEqual(stats.httpStatus, {
        total: 5,
        successful: 2,
        clientErrors: 2,
        serverErrors: 1,
        rateLimited: 1,
        clientErrorRate: 40,
        serverErrorRate: 20,
        rateLimitedRate: 20,
    });
    assert.equal(stats.routes['GET /api/health'].count, 2);
    assert.equal(stats.routes['GET /api/bookings/:id'].p95, 1000);
    assert.equal(stats.userAgentFamilies.googlebot, 1);
    assert.equal(stats.recentErrors[0].message, 'Internal server error');
    assert.equal(stats.recentErrors[0].path, '/api/bookings/:id');
});

test('writes production logs as persistent JSON without ANSI formatting', async () => {
    const logDirectory = await mkdtemp(path.join(os.tmpdir(), 'sath-stage7b-'));
    try {
        const logger = createApplicationLogger({
            environment: 'production',
            logDirectory,
            consoleEnabled: false,
            maxSizeBytes: 1024 * 1024,
            maxFiles: 2,
        });

        logger.info('HTTP request completed', {
            correlationId: 'request-safe-1234',
            route: '/api/health',
            email: 'private@example.test',
            accessToken: 'secret-token',
        });
        const logPath = path.join(logDirectory, 'application.log');
        let persistedContent = '';
        for (let attempt = 0; attempt < 20 && !persistedContent; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 25));
            persistedContent = await readFile(logPath, 'utf8').catch(() => '');
        }
        logger.close();

        const persisted = JSON.parse(persistedContent.trim());
        assert.equal(persisted.message, 'HTTP request completed');
        assert.equal(persisted.correlationId, 'request-safe-1234');
        assert.equal(persisted.route, '/api/health');
        assert.equal(JSON.stringify(persisted).includes(String.fromCharCode(27)), false);
        assert.doesNotMatch(JSON.stringify(persisted), /private@example\.test|secret-token/);
    } finally {
        await rm(logDirectory, { recursive: true, force: true });
    }
});

test('dispatches warning alerts, removes sensitive context and deduplicates repeated events', async () => {
    let nowMs = 1_000;
    const webhookPayloads = [];
    const emails = [];
    const logs = [];
    const alerts = createAlertService({
        webhookUrl: 'https://alerts.example.test/hook',
        adminEmail: 'ops@example.test',
        environment: 'production',
        dedupWindowMs: 60_000,
        now: () => nowMs,
        httpClient: { post: async (_url, payload) => webhookPayloads.push(payload) },
        sendEmailFn: async (payload) => emails.push(payload),
        log: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    });
    const unsafeContext = {
        alertKey: 'HTTP_SLOW',
        component: 'API_PERFORMANCE',
        route: '/api/bookings/:id',
        durationMs: 2500,
        correlationId: 'request-safe-1234',
        email: 'private@example.test',
        ip: '203.0.113.10',
        accessToken: 'secret-token',
    };

    const first = await alerts.notify(new Error('Slow request'), unsafeContext, SEVERITY.WARNING);
    const duplicate = await alerts.notify(new Error('Slow request'), unsafeContext, SEVERITY.WARNING);
    nowMs += 60_001;
    const afterWindow = await alerts.notify(new Error('Slow request'), unsafeContext, SEVERITY.WARNING);

    assert.equal(first.dispatched.webhook, true);
    assert.equal(duplicate.deduplicated, true);
    assert.equal(afterWindow.dispatched.webhook, true);
    assert.equal(webhookPayloads.length, 2);
    assert.equal(emails.length, 0);
    const serialized = JSON.stringify({ webhookPayloads, logs });
    assert.doesNotMatch(serialized, /private@example\.test|203\.0\.113\.10|secret-token/);

    await alerts.notify(new Error('Database unavailable'), { alertKey: 'DB_DOWN', component: 'DB' }, SEVERITY.CRITICAL);
    assert.equal(emails.length, 1);
});

test('collects DB, disk, cache and payment outbox saturation with actionable signals', async () => {
    const pool = {
        totalCount: 8,
        idleCount: 3,
        waitingCount: 2,
        async query(sql) {
            if (String(sql).includes('SELECT 1')) return { rows: [{ '?column?': 1 }] };
            if (String(sql).includes('FROM payment_outbox')) {
                return {
                    rows: [{
                        pending_count: '4',
                        failed_count: '1',
                        oldest_pending_seconds: '420',
                    }],
                };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };

    const snapshot = await collectOperationalSnapshot({
        pool,
        cacheStats: () => ({ keys: 4, hits: 10, misses: 2, hitRate: 83.33 }),
        statfs: async () => ({ bsize: 100, blocks: 1000, bavail: 80 }),
        directories: { uploads: 'uploads', privateUploads: 'private_uploads' },
        thresholds: { dbWaiting: 1, diskFreePercent: 10, outboxLagSeconds: 300 },
    });

    assert.deepEqual(snapshot.database, { status: 'connected', total: 8, idle: 3, waiting: 2 });
    assert.equal(snapshot.storage.uploads.freePercent, 8);
    assert.equal(snapshot.cache.hitRate, 83.33);
    assert.deepEqual(snapshot.outbox, { pending: 4, failed: 1, oldestPendingSeconds: 420 });
    assert.deepEqual(snapshot.signals.map((signal) => signal.code).sort(), [
        'DB_POOL_WAITING',
        'PAYMENT_OUTBOX_ERRORS',
        'PAYMENT_OUTBOX_LAG',
        'UPLOAD_STORAGE_LOW',
    ]);
});

test('reports unavailable DB, outbox and upload storage without exposing failure details', async () => {
    const databaseError = Object.assign(new Error('connection string must stay private'), { code: 'DB_DOWN' });
    const storageError = Object.assign(new Error('private filesystem path'), { code: 'ENOENT' });
    const snapshot = await collectOperationalSnapshot({
        pool: {
            totalCount: 0,
            idleCount: 0,
            waitingCount: 0,
            query: async () => { throw databaseError; },
        },
        cacheStats: () => ({}),
        statfs: async () => { throw storageError; },
        directories: { uploads: 'uploads', privateUploads: 'private_uploads' },
    });

    assert.equal(snapshot.database.status, 'disconnected');
    assert.equal(snapshot.outbox.errorCode, 'DB_DOWN');
    assert.equal(snapshot.storage.uploads.errorCode, 'ENOENT');
    assert.deepEqual(snapshot.signals.map(({ code }) => code).sort(), [
        'DATABASE_UNAVAILABLE',
        'PAYMENT_OUTBOX_UNAVAILABLE',
        'UPLOAD_STORAGE_UNAVAILABLE',
    ]);
    assert.doesNotMatch(JSON.stringify(snapshot), /connection string|private filesystem path/);
});
