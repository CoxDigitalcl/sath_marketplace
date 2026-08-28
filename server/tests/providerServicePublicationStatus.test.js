import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../config/db.js';
import { updateServicePublicationStatus } from '../controllers/serviceController.js';

const SERVICE_ID = '0d4ae10c-2900-4507-8fa9-fa469cee5dce';
const PROVIDER_ID = 'cabd0e9e-1c46-4a2a-90ce-123012301230';
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

test('rejects status changes for services that are still pending moderation', async () => {
    let queryCount = 0;
    pool.query = async () => {
        queryCount += 1;
        return {
            rows: [{ provider_id: PROVIDER_ID, moderation_status: 'pending', is_active: false }]
        };
    };

    const req = {
        params: { id: SERVICE_ID },
        body: { is_active: true },
        user: { id: PROVIDER_ID }
    };
    const res = responseRecorder();
    let nextError = null;

    await updateServicePublicationStatus(req, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'SERVICE_NOT_APPROVED');
    assert.equal(queryCount, 1);
});

test('persists an approved service status without changing moderation', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
        calls.push({ sql: String(sql), params });
        if (calls.length === 1) {
            return {
                rows: [{ provider_id: PROVIDER_ID, moderation_status: 'approved', is_active: false }]
            };
        }
        return {
            rows: [{
                id: SERVICE_ID,
                is_active: true,
                moderation_status: 'approved',
                updated_at: '2026-08-28T12:00:00.000Z'
            }]
        };
    };

    const req = {
        params: { id: SERVICE_ID },
        body: { is_active: true },
        user: { id: PROVIDER_ID }
    };
    const res = responseRecorder();
    let nextError = null;

    await updateServicePublicationStatus(req, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.service.is_active, true);
    assert.equal(res.body.service.moderation_status, 'approved');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].params, [true, SERVICE_ID, PROVIDER_ID]);
    assert.match(calls[1].sql, /SET is_active = \$1/);
    assert.match(calls[1].sql, /AND moderation_status = 'approved'/);
    assert.doesNotMatch(calls[1].sql.split('WHERE')[0], /moderation_status\s*=/);
});

test('validates ownership and the boolean request contract at the boundary', async () => {
    let queryCount = 0;
    pool.query = async () => {
        queryCount += 1;
        return {
            rows: [{ provider_id: '93bbf5ad-294a-4835-ac9f-456045604560', moderation_status: 'approved', is_active: false }]
        };
    };

    const invalidBodyResponse = responseRecorder();
    await updateServicePublicationStatus({
        params: { id: SERVICE_ID },
        body: { is_active: 'true' },
        user: { id: PROVIDER_ID }
    }, invalidBodyResponse, () => {});

    assert.equal(invalidBodyResponse.statusCode, 400);
    assert.equal(invalidBodyResponse.body.code, 'INVALID_SERVICE_STATUS');
    assert.equal(queryCount, 0);

    const forbiddenResponse = responseRecorder();
    await updateServicePublicationStatus({
        params: { id: SERVICE_ID },
        body: { is_active: true },
        user: { id: PROVIDER_ID }
    }, forbiddenResponse, () => {});

    assert.equal(forbiddenResponse.statusCode, 403);
    assert.equal(forbiddenResponse.body.code, 'SERVICE_STATUS_FORBIDDEN');
    assert.equal(queryCount, 1);
});
