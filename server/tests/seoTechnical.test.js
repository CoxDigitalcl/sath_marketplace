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

const SITE_ORIGIN = 'https://serviciosatuhogar.cl';
const VERIFIED_PROVIDER_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const SERVICE_ID = '33333333-3333-4333-8333-333333333333';
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

before(async () => {
    process.env.APP_URL = SITE_ORIGIN;

    const fakeDb = {
        pool: {
            query: async (sql, params) => {
                assert.match(sql, /u\.is_verified = TRUE/);
                if (params[0] !== VERIFIED_PROVIDER_ID) return { rows: [] };
                return {
                    rows: [{
                        name: 'Ana <script>alert("x")</script>',
                        bio: 'Profesional verificada\ncon experiencia.',
                        profile_image_url: '/uploads/provider-photo.webp'
                    }]
                };
            }
        }
    };
    const app = express();
    app.use(createSeoFrontendRouter({ db: fakeDb, indexHtml: INDEX_HTML }));
    app.use((req, res) => res.status(404).send('Not found'));

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
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

test('sitemap contains only the reviewed static public canonical URLs', () => {
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

test('robots and sitemap endpoints return real text/XML resources with bounded caching', async () => {
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
    assert.equal(sitemap.includes('/checkout'), false);
});

test('public shell has canonical metadata and is never cached for one year', async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
    assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
    assert.match(html, /<link rel="canonical" href="https:\/\/serviciosatuhogar\.cl\/"/);
    assert.match(html, /<meta name="description"/);
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

test('unknown routes and malformed dynamic IDs return an honest 404 with noindex', async () => {
    for (const pathname of ['/invented-route', '/provider/not-a-uuid', '/assets/missing.js']) {
        const response = await fetch(`${baseUrl}${pathname}`);
        assert.equal(response.status, 404, pathname);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', pathname);
    }
});

test('provider metadata is emitted only for a verified provider record', async () => {
    const verifiedResponse = await fetch(`${baseUrl}/provider/${VERIFIED_PROVIDER_ID}`);
    const verifiedHtml = await verifiedResponse.text();
    assert.equal(verifiedResponse.status, 200);
    assert.equal(verifiedResponse.headers.get('x-robots-tag'), 'index, follow');
    assert.match(verifiedHtml, /Ana &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
    assert.match(verifiedHtml, /https:\/\/serviciosatuhogar\.cl\/uploads\/provider-photo\.webp/);

    const missingResponse = await fetch(`${baseUrl}/provider/${MISSING_PROVIDER_ID}`);
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});

