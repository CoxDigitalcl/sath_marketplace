import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../config/db.js';
import { getAdminServices, moderateService } from '../controllers/serviceController.js';

const SERVICE_ID = '0d4ae10c-2900-4507-8fa9-fa469cee5dce';
const ADMIN_ID = 'cabd0e9e-1c46-4a2a-90ce-123012301230';
const originalQuery = pool.query;

const responseRecorder = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test.afterEach(() => {
    pool.query = originalQuery;
});

test('disables blind service moderation in favor of revision decisions', async () => {
    let queryCount = 0;
    pool.query = async () => {
        queryCount += 1;
        return { rows: [] };
    };
    const res = responseRecorder();
    let nextError = null;
    await moderateService({
        params: { id: SERVICE_ID },
        body: { status: 'approved', reason: '' },
        user: { id: ADMIN_ID }
    }, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 410);
    assert.equal(res.body.code, 'SERVICE_MODERATION_MOVED');
    assert.equal(queryCount, 0);
});

test('does not mutate through the retired rejection endpoint', async () => {
    let queryCount = 0;
    pool.query = async () => {
        queryCount += 1;
        return { rows: [] };
    };

    const res = responseRecorder();
    await moderateService({
        params: { id: SERVICE_ID },
        body: { status: 'rejected', reason: '   ' },
        user: { id: ADMIN_ID }
    }, res, () => {});

    assert.equal(res.statusCode, 410);
    assert.equal(res.body.code, 'SERVICE_MODERATION_MOVED');
    assert.equal(queryCount, 0);
});

test('maps the cover image used by the admin service thumbnail', async () => {
    pool.query = async () => ({
        rows: [{
            id: SERVICE_ID,
            title: 'Payaso a domicilio',
            price: 5000,
            cover_image_url: '/uploads/services/payaso.webp',
            image_urls: []
        }]
    });

    const res = responseRecorder();
    let nextError = null;
    await getAdminServices({}, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.services[0].coverImageUrl, '/uploads/services/payaso.webp');
    assert.deepEqual(res.body.services[0].imageUrls, []);
});
