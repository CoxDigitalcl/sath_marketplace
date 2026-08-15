import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import express from 'express';

import { createSeoFrontendRouter } from '../middleware/seoFrontend.js';
import {
    buildRobotsTxt,
    buildSitemapXml,
    getRouteSeo,
    injectSeoMetadata,
    isKnownSpaRoute
} from '../services/seoService.js';
import { buildProviderPath, buildServicePath } from '../../shared/publicPaths.js';

const SITE_ORIGIN = 'https://serviciosatuhogar.cl';
const VERIFIED_PROVIDER_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const SERVICE_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_SERVICE_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_TITLE = 'Gasfitería <urgente>';
const PROVIDER_NAME = 'Ana <script>alert("x")</script>';
const SERVICE_PATH = buildServicePath(SERVICE_ID, SERVICE_TITLE);
const PROVIDER_PATH = buildProviderPath(VERIFIED_PROVIDER_ID, PROVIDER_NAME);
const INDEX_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="description" content="old description" />
  <title>Old title</title>
</head>
<body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>
</html>`;

let server;
let baseUrl;

const fakeDb = {
    pool: {
        query: async (sql, params = []) => {
            assert.doesNotMatch(sql, /u\.is_verified/, 'provider publication must use provider_profiles.is_verified');

            if (/FROM platform_settings/.test(sql)) {
                assert.match(sql, /group_name = 'legal_policies'/);
                return {
                    rows: [{
                        key: 'legal_policies',
                        value: [
                            {
                                title: 'Política <segura> de privacidad',
                                slug: 'politica-de-privacidad',
                                content: '<p>Explica el tratamiento responsable de datos personales.</p>',
                                isActive: true
                            },
                            {
                                title: 'Borrador interno',
                                slug: 'borrador-interno',
                                content: '<p>No publicar.</p>',
                                isActive: false
                            }
                        ]
                    }]
                };
            }

            if (/ORDER BY s\.created_at DESC[\s\S]*LIMIT/.test(sql)) {
                assert.match(sql, /s\.is_active = TRUE/);
                assert.match(sql, /s\.moderation_status = 'approved'/);
                assert.match(sql, /pp\.is_verified = TRUE/);
                assert.match(sql, /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
                return {
                    rows: [{
                        id: SERVICE_ID,
                        provider_id: VERIFIED_PROVIDER_ID,
                        title: SERVICE_TITLE,
                        description: 'Reparación segura de filtraciones y artefactos.',
                        price: 45000,
                        type: 'presencial',
                        provider_name: PROVIDER_NAME,
                        coverage_area: 'Santiago'
                    }]
                };
            }

            if (/SELECT\s+s\.id,\s+s\.title\s+FROM services s/.test(sql) && params.length === 0) {
                assert.match(sql, /s\.is_active = TRUE/);
                assert.match(sql, /s\.moderation_status = 'approved'/);
                assert.match(sql, /pp\.is_verified = TRUE/);
                assert.match(sql, /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
                return { rows: [{ id: SERVICE_ID, title: SERVICE_TITLE }, { id: 'not-a-uuid', title: 'No publicar' }] };
            }

            if (/SELECT\s+pp\.user_id AS id,[\s\S]+AS name\s+FROM provider_profiles pp/.test(sql) && params.length === 0) {
                assert.match(sql, /pp\.is_verified = TRUE/);
                assert.match(sql, /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
                return { rows: [{ id: VERIFIED_PROVIDER_ID, name: PROVIDER_NAME }, { id: 'not-a-uuid', name: 'No publicar' }] };
            }

            if (/FROM services s/.test(sql) && params.length === 1) {
                assert.match(sql, /s\.is_active = TRUE/);
                assert.match(sql, /s\.moderation_status = 'approved'/);
                assert.match(sql, /pp\.is_verified = TRUE/);
                assert.match(sql, /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
                if (params[0] !== SERVICE_ID) return { rows: [] };
                return {
                    rows: [{
                        id: SERVICE_ID,
                        provider_id: VERIFIED_PROVIDER_ID,
                        title: SERVICE_TITLE,
                        description: 'Reparación segura de filtraciones y artefactos.',
                        price: 45000,
                        type: 'presencial',
                        image_urls: ['/uploads/service-photo.webp'],
                        provider_name: PROVIDER_NAME,
                        coverage_area: 'Santiago',
                        coverage_region_name: 'Región Metropolitana'
                    }]
                };
            }

            if (/FROM provider_profiles pp/.test(sql) && params.length === 1) {
                assert.match(sql, /pp\.is_verified = TRUE/);
                assert.match(sql, /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
                assert.match(sql, /profile_image_status = 'approved'/);
                if (params[0] !== VERIFIED_PROVIDER_ID) return { rows: [] };
                return {
                    rows: [{
                        id: VERIFIED_PROVIDER_ID,
                        name: PROVIDER_NAME,
                        bio: 'Profesional verificada\ncon experiencia.',
                        profile_image_url: '/uploads/provider-photo.webp',
                        coverage_area: 'Santiago',
                        coverage_region_name: 'Región Metropolitana'
                    }]
                };
            }

            throw new Error(`Unexpected SEO query: ${sql}`);
        }
    }
};

before(async () => {
    process.env.APP_URL = SITE_ORIGIN;

    const app = express();
    app.use(createSeoFrontendRouter({ db: fakeDb, indexHtml: INDEX_HTML }));
    app.use((req, res) => res.status(404).send('Not found'));

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (!server) return;
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

test('known SPA route classifier rejects arbitrary and malformed detail paths', () => {
    assert.equal(isKnownSpaRoute('/'), true);
    assert.equal(isKnownSpaRoute('/categories/hogar'), true);
    assert.equal(isKnownSpaRoute(`/service/${SERVICE_ID}`), true);
    assert.equal(isKnownSpaRoute(SERVICE_PATH), true);
    assert.equal(isKnownSpaRoute('/provider/not-a-uuid'), false);
    assert.equal(isKnownSpaRoute('/admin/users'), false);
    assert.equal(isKnownSpaRoute('/invented-route'), false);
});

test('robots.txt points to the sitemap and keeps private surfaces out of crawl', () => {
    const robots = buildRobotsTxt(SITE_ORIGIN);

    assert.match(robots, /^User-agent: \*$/m);
    assert.match(robots, /^Allow: \/$/m);
    assert.match(robots, /^Disallow: \/api\/$/m);
    assert.match(robots, /^Disallow: \/admin$/m);
    assert.match(robots, /^Disallow: \/checkout$/m);
    assert.match(robots, /^Sitemap: https:\/\/serviciosatuhogar\.cl\/sitemap\.xml$/m);
});

test('static sitemap helper remains restricted to reviewed canonical roots', () => {
    const sitemap = buildSitemapXml(SITE_ORIGIN);

    assert.match(sitemap, /<loc>https:\/\/serviciosatuhogar\.cl\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/serviciosatuhogar\.cl\/categories<\/loc>/);
    for (const forbidden of ['/api', '/admin', '/dashboard', '/auth', '/login', '/checkout', 'token=', '/service/', '/provider/']) {
        assert.equal(sitemap.includes(forbidden), false, `sitemap leaked ${forbidden}`);
    }
});

test('metadata injection replaces old tags and escapes database-controlled values', () => {
    const seo = getRouteSeo({
        pathname: `/provider/${VERIFIED_PROVIDER_ID}`,
        overrides: {
            title: 'Ana <script>alert("x")</script>',
            description: 'Servicio "especial" & seguro'
        }
    });
    const html = injectSeoMetadata(INDEX_HTML, seo);

    assert.equal(html.includes('Old title'), false);
    assert.equal(html.includes('old description'), false);
    assert.equal(html.includes('<script>alert("x")</script>'), false);
    assert.match(html, /Ana &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
    assert.match(html, /rel="canonical" href="https:\/\/serviciosatuhogar\.cl\/provider\//);
});

test('robots and dynamic sitemap return real resources with bounded caching', async () => {
    const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsResponse.status, 200);
    assert.match(robotsResponse.headers.get('content-type'), /^text\/plain/);
    assert.match(robotsResponse.headers.get('cache-control'), /max-age=3600/);
    assert.match(await robotsResponse.text(), /^User-agent: \*/);

    const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapResponse.status, 200);
    assert.match(sitemapResponse.headers.get('content-type'), /^application\/xml/);
    assert.match(sitemapResponse.headers.get('cache-control'), /max-age=3600/);
    const sitemap = await sitemapResponse.text();
    assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(sitemap, new RegExp(`/categories/hogar`));
    assert.match(sitemap, new RegExp(SERVICE_PATH));
    assert.match(sitemap, new RegExp(PROVIDER_PATH));
    assert.match(sitemap, /\/legal\/politica-de-privacidad/);
    assert.equal(sitemap.includes('borrador-interno'), false);
    assert.equal(sitemap.includes('not-a-uuid'), false);
    assert.equal(sitemap.includes('/checkout'), false);
});

test('legacy identifiers and stale slugs redirect permanently to one canonical detail URL', async () => {
    const cases = [
        [`/service/${SERVICE_ID}`, SERVICE_PATH],
        [`/service/slug-obsoleto-${SERVICE_ID}`, SERVICE_PATH],
        [`/provider/${VERIFIED_PROVIDER_ID}`, PROVIDER_PATH],
        [`/provider/slug-obsoleto-${VERIFIED_PROVIDER_ID}`, PROVIDER_PATH]
    ];

    for (const [legacyPath, canonicalPath] of cases) {
        const response = await fetch(`${baseUrl}${legacyPath}`, { redirect: 'manual' });

        assert.equal(response.status, 308, legacyPath);
        assert.equal(response.headers.get('location'), `${SITE_ORIGIN}${canonicalPath}`, legacyPath);
    }
});

test('canonical detail paths do not create redirect chains', async () => {
    assert.equal((await fetch(`${baseUrl}${SERVICE_PATH}`, { redirect: 'manual' })).status, 200);
    assert.equal((await fetch(`${baseUrl}${PROVIDER_PATH}`, { redirect: 'manual' })).status, 200);
});

test('public shell has canonical metadata and short-lived HTML caching', async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
    assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
    assert.match(html, /<link rel="canonical" href="https:\/\/serviciosatuhogar\.cl\/"/);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /data-public-ssr="true"/);
    assert.match(html, /<h1[^>]*>Encuentra servicios confiables para tu hogar en Chile<\/h1>/);
    assert.match(html, new RegExp(`href="${SERVICE_PATH}"`));
    assert.match(html, /<script id="public-ssr-state" type="application\/json">/);
    assert.doesNotMatch(html, /window\.__PUBLIC_SSR__/);
    assert.equal(html.includes('<div id="root"></div>'), false);
});

test('private, transactional, search, and tokenized routes emit noindex headers', async () => {
    const loginResponse = await fetch(`${baseUrl}/login?token=secret`);
    const loginHtml = await loginResponse.text();
    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(loginHtml.includes('rel="canonical"'), false);
    assert.equal(loginHtml.includes('secret'), false);

    const checkoutResponse = await fetch(`${baseUrl}/checkout?order=123`);
    assert.equal(checkoutResponse.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

    const searchResponse = await fetch(`${baseUrl}/search?q=gasfiteria`);
    const searchHtml = await searchResponse.text();
    assert.equal(searchResponse.headers.get('x-robots-tag'), 'noindex, follow');
    assert.match(searchHtml, /rel="canonical" href="https:\/\/serviciosatuhogar\.cl\/search"/);
});

test('unknown, malformed, and unpublished resources return an honest 404', async () => {
    const paths = [
        '/invented-route',
        '/provider/not-a-uuid',
        `/provider/${MISSING_PROVIDER_ID}`,
        `/service/${MISSING_SERVICE_ID}`,
        '/categories/no-publicada',
        '/legal/borrador-interno',
        '/assets/missing.js'
    ];

    for (const pathname of paths) {
        const response = await fetch(`${baseUrl}${pathname}`);
        const body = await response.text();
        assert.equal(response.status, 404, pathname);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', pathname);
        assert.equal(body.includes('rel="canonical"'), false, pathname);
    }
});

test('curated categories receive unique public metadata', async () => {
    const response = await fetch(`${baseUrl}/categories/hogar`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
    assert.match(html, /<title>Hogar y Mantención \| Servicios a tu Hogar<\/title>/);
    assert.match(html, /rel="canonical" href="https:\/\/serviciosatuhogar\.cl\/categories\/hogar"/);
    assert.match(html, /<h1[^>]*>Hogar y Mantención<\/h1>/);
    assert.match(html, new RegExp(`href="${SERVICE_PATH}"`));
});

test('service metadata is emitted only for an approved public service', async () => {
    const response = await fetch(`${baseUrl}${SERVICE_PATH}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
    assert.match(html, /Gasfitería &lt;urgente&gt; \| Servicios a tu Hogar/);
    assert.match(html, /https:\/\/serviciosatuhogar\.cl\/uploads\/service-photo\.webp/);
    assert.match(html, /<h1[^>]*>Gasfitería &lt;urgente&gt;<\/h1>/);
    assert.match(html, /Reparación segura de filtraciones y artefactos\./);
    assert.match(html, /\$45\.000/);
    assert.match(html, new RegExp(`href="${PROVIDER_PATH}"`));
});

test('provider metadata is emitted only for a verified, unblocked provider', async () => {
    const response = await fetch(`${baseUrl}${PROVIDER_PATH}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
    assert.match(html, /Ana &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
    assert.match(html, /https:\/\/serviciosatuhogar\.cl\/uploads\/provider-photo\.webp/);
    assert.match(html, /data-route-id="provider"/);
    assert.match(html, new RegExp(`href="${SERVICE_PATH}"`));
});

test('only active public legal policies receive canonical metadata', async () => {
    const response = await fetch(`${baseUrl}/legal/politica-de-privacidad`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
    assert.match(html, /Política &lt;segura&gt; de privacidad \| Servicios a tu Hogar/);
    assert.match(html, /tratamiento responsable de datos personales/);
    assert.match(html, /de privacidad: Explica el tratamiento responsable de datos personales/);
    assert.match(html, /data-route-id="legal"/);
});

test('crawler and browser receive equivalent server-rendered public content', async () => {
    const pathname = SERVICE_PATH;
    const browserResponse = await fetch(`${baseUrl}${pathname}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const crawlerResponse = await fetch(`${baseUrl}${pathname}`, {
        headers: { 'User-Agent': 'Googlebot/2.1' }
    });

    assert.equal(browserResponse.status, 200);
    assert.equal(crawlerResponse.status, 200);
    assert.equal(await crawlerResponse.text(), await browserResponse.text());
});

test('SSR loader errors return a controlled 503 instead of an empty 200 shell', async () => {
    const failingApp = express();
    failingApp.use(createSeoFrontendRouter({
        db: { pool: { query: async () => { throw new Error('database unavailable'); } } },
        indexHtml: INDEX_HTML
    }));
    const failingServer = await new Promise((resolve) => {
        const instance = failingApp.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const response = await fetch(`http://127.0.0.1:${failingServer.address().port}/categories/hogar`);
        const html = await response.text();
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
        assert.equal(response.headers.get('retry-after'), '30');
        assert.match(html, /No pudimos cargar esta página/);
    } finally {
        await new Promise((resolve, reject) => failingServer.close((error) => error ? reject(error) : resolve()));
    }
});
