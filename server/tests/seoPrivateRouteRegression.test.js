import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import express from 'express';

import { createSeoFrontendRouter } from '../middleware/seoFrontend.js';

const INDEX_HTML = `<!doctype html>
<html lang="es">
<head><title>App</title></head>
<body><div id="root"></div></body>
</html>`;

let server;
let baseUrl;
let providerQueries = 0;

before(async () => {
    process.env.APP_URL = 'https://serviciosatuhogar.cl';

    const fakeDb = {
        pool: {
            query: async () => {
                providerQueries += 1;
                return { rows: [] };
            }
        }
    };

    const app = express();
    app.use(createSeoFrontendRouter({ db: fakeDb, indexHtml: INDEX_HTML }));

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

test('private provider routes bypass public provider lookup and remain noindex', async () => {
    for (const pathname of ['/provider/dashboard', '/provider/register']) {
        const response = await fetch(`${baseUrl}${pathname}`);
        assert.equal(response.status, 200, pathname);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', pathname);
    }

    assert.equal(providerQueries, 0, 'private provider paths must never query the public profile loader');
});

test('404 pages do not emit a canonical URL', async () => {
    const response = await fetch(`${baseUrl}/invented-route`);
    const html = await response.text();

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(html.includes('rel="canonical"'), false);
});
