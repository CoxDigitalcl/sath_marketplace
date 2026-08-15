import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
    PUBLIC_ROUTE_MANIFEST,
    loadPublicRouteDocument,
    resolveApplicationRoute
} from '../services/publicRouteManifest.js';
import { injectPublicSsr } from '../ssr/entryServer.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(testDirectory, '..', '..');

test('route manifest is the executable source of truth for public and private pages', () => {
    const byId = new Map(PUBLIC_ROUTE_MANIFEST.map((route) => [route.id, route]));

    for (const id of ['home', 'categories', 'category', 'service', 'provider', 'legal']) {
        const route = byId.get(id);
        assert.ok(route, id);
        assert.equal(route.renderMode, 'ssr', id);
        assert.equal(route.indexable, true, id);
        assert.equal(route.sitemap, true, id);
        assert.equal(typeof route.load, 'function', id);
        assert.equal(typeof route.build, 'function', id);
    }

    for (const id of ['login', 'admin', 'provider-dashboard', 'checkout', 'reset-password']) {
        const route = byId.get(id);
        assert.ok(route, id);
        assert.equal(route.renderMode, 'csr', id);
        assert.equal(route.indexable, false, id);
        assert.equal(route.sitemap, false, id);
    }

    assert.equal(resolveApplicationRoute('/categories/hogar')?.definition.id, 'category');
    assert.equal(resolveApplicationRoute('/provider/dashboard')?.definition.id, 'provider-dashboard');
    assert.equal(resolveApplicationRoute('/not-a-route'), null);
});

test('server entry escapes markup and serialized state controlled by public records', () => {
    const html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
    const page = {
        kind: 'error',
        routeId: 'escape-test',
        heading: '</script><script>alert("x")</script>',
        description: 'Texto & seguro',
        breadcrumbs: []
    };

    const rendered = injectPublicSsr(html, page);
    assert.match(rendered, /data-public-ssr="true"/);
    assert.match(rendered, /&lt;\/script&gt;&lt;script&gt;alert/);
    assert.match(rendered, /window\.__PUBLIC_SSR__=/);
    assert.equal(rendered.includes('</script><script>alert("x")'), false);
    assert.match(rendered, /\\u003c\/script\\u003e/);
});

test('client entry hydrates SSR markup and retains CSR mounting for private routes', () => {
    const clientEntry = fs.readFileSync(path.join(projectRoot, 'src', 'index.tsx'), 'utf8');
    const routes = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'AppRoutes.tsx'), 'utf8');

    assert.match(clientEntry, /import \{ createRoot, hydrateRoot \} from 'react-dom\/client'/);
    assert.match(clientEntry, /window\.__PUBLIC_SSR__/);
    assert.match(clientEntry, /hydrateRoot\(rootElement, application\)/);
    assert.match(clientEntry, /createRoot\(rootElement\)\.render\(application\)/);
    assert.match(clientEntry, /PublicSsrView/);
    for (const modulePath of [
        '../components/HomePage',
        '../components/public/SearchResultsPage',
        '../components/public/ServiceDetailPage',
        '../components/public/ProviderPublicProfile',
        '../components/public/CategoriesHubPage',
        '../components/public/CategoryDetailPage',
        '../components/public/LegalPolicy'
    ]) {
        assert.ok(routes.includes(`React.lazy(() => import('${modulePath}'))`), modulePath);
    }
    assert.match(routes, /React\.lazy\(\(\) => import\('\.\.\/components\/admin\/AdminDashboard'\)\)/);
    assert.match(routes, /React\.lazy\(\(\) => import\('\.\.\/components\/provider\/ProviderDashboard'\)\)/);
    assert.match(routes, /React\.lazy\(\(\) => import\('\.\.\/components\/client\/ClientDashboard'\)\)/);
    assert.match(routes, /React\.Suspense/);
});

test('public SSR loaders have a bounded timeout instead of hanging or returning an empty 200', async () => {
    const previousTimeout = process.env.SSR_LOADER_TIMEOUT_MS;
    process.env.SSR_LOADER_TIMEOUT_MS = '250';

    try {
        await assert.rejects(
            loadPublicRouteDocument({
                pathname: '/categories/hogar',
                db: { pool: { query: async () => new Promise(() => {}) } }
            }),
            (error) => error?.code === 'SSR_LOADER_TIMEOUT'
        );
    } finally {
        if (previousTimeout === undefined) delete process.env.SSR_LOADER_TIMEOUT_MS;
        else process.env.SSR_LOADER_TIMEOUT_MS = previousTimeout;
    }
});
