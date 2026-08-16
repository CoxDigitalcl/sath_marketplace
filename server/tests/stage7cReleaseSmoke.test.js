import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeStage7cBaseUrl,
    runStage7cReleaseSmoke,
} from '../scripts/run_stage7c_release_smoke.js';

const securityHeaders = {
    'content-security-policy': "default-src 'self'; object-src 'none'",
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
};

const response = (body, { status = 200, headers = {} } = {}) => new Response(body, {
    status,
    headers: { ...securityHeaders, ...headers },
});

const createHealthyFetch = ({ omitHsts = false, crawlerMismatch = false } = {}) => {
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url: String(url), options });
        const pathname = new URL(url).pathname;
        const headers = omitHsts ? { 'strict-transport-security': '' } : {};

        if (pathname === '/api/health') {
            return response(JSON.stringify({ status: 'ok', db_connection: 'connected' }), {
                headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
            });
        }
        if (pathname === '/') {
            const crawler = options.headers['user-agent'].startsWith('Googlebot/');
            const heading = crawler && crawlerMismatch ? 'Contenido divergente' : 'Servicios';
            return response(`<html><head><link rel="canonical" href="https://example.test/"></head><body><h1>${heading}</h1></body></html>`, {
                headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'index, follow' },
            });
        }
        if (pathname === '/robots.txt') {
            return response('User-agent: *\nSitemap: https://example.test/sitemap.xml\n', {
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            });
        }
        if (pathname === '/sitemap.xml') {
            return response('<?xml version="1.0"?><urlset><url><loc>https://example.test/</loc></url></urlset>', {
                headers: { 'content-type': 'application/xml; charset=utf-8' },
            });
        }
        if (pathname === '/login') {
            return response('<html><body>Login</body></html>', {
                headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow, noarchive' },
            });
        }
        if (pathname === '/__stage7c_smoke_not_found__') {
            return response('<html><body>Not found</body></html>', {
                status: 404,
                headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow, noarchive' },
            });
        }
        throw new Error(`Unexpected smoke URL: ${pathname}`);
    };
    return { calls, fetchImpl };
};

test('stage 7C release smoke is read-only and validates the public production contract', async () => {
    const { calls, fetchImpl } = createHealthyFetch();
    const result = await runStage7cReleaseSmoke({
        baseUrl: 'https://example.test',
        fetchImpl,
        timeoutMs: 2_000,
    });

    assert.equal(result.ok, true);
    assert.equal(result.targetOrigin, 'https://example.test');
    assert.equal(result.checks.length, 7);
    assert.equal(result.checks.every(({ ok }) => ok), true);
    assert.equal(calls.length, 7);
    for (const call of calls) {
        assert.equal(call.options.method, 'GET');
        assert.equal(call.options.redirect, 'manual');
        assert.equal('authorization' in call.options.headers, false);
        assert.equal('cookie' in call.options.headers, false);
        assert.equal(call.options.body, undefined);
    }
});

test('stage 7C release smoke fails closed when crawler content diverges', async () => {
    const { fetchImpl } = createHealthyFetch({ crawlerMismatch: true });
    const result = await runStage7cReleaseSmoke({
        baseUrl: 'https://example.test',
        fetchImpl,
        timeoutMs: 2_000,
    });

    assert.equal(result.ok, false);
    assert.equal(result.checks.some(({ name, ok, error }) => name === 'crawler_parity' && !ok && /H1 differs/i.test(error)), true);
});

test('stage 7C release smoke fails closed when a security header disappears', async () => {
    const { fetchImpl } = createHealthyFetch({ omitHsts: true });
    const result = await runStage7cReleaseSmoke({
        baseUrl: 'https://example.test',
        fetchImpl,
        timeoutMs: 2_000,
    });

    assert.equal(result.ok, false);
    assert.equal(result.checks.some(({ ok, error }) => !ok && /strict-transport-security/i.test(error)), true);
});

test('stage 7C target rejects credentials, query parameters and non-local HTTP', () => {
    assert.throws(() => normalizeStage7cBaseUrl('http://example.test'), /HTTPS/);
    assert.throws(() => normalizeStage7cBaseUrl('https://user:pass@example.test'), /credentials/);
    assert.throws(() => normalizeStage7cBaseUrl('https://example.test/?token=value'), /query parameters/);
    assert.equal(
        normalizeStage7cBaseUrl('http://127.0.0.1:3001', { allowLocalHttp: true }).origin,
        'http://127.0.0.1:3001',
    );
});
