import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../config/db.js';
import { getMyServices } from '../controllers/serviceController.js';

const SERVICE_ID = '0d4ae10c-2900-4507-8fa9-fa469cee5dce';
const PROVIDER_ID = 'cabd0e9e-1c46-4a2a-90ce-123012301230';
const REVISION_ID = '93bbf5ad-294a-4835-ac9f-456045604560';
const originalQuery = pool.query;

const responseRecorder = () => ({
    body: null,
    json(body) {
        this.body = body;
        return this;
    }
});

test.afterEach(() => {
    pool.query = originalQuery;
});

test('keeps publication active while projecting a pending proposal into the provider editor', async () => {
    let queryText = '';
    pool.query = async (sql) => {
        queryText = String(sql);
        return {
            rows: [{
                id: SERVICE_ID,
                provider_id: PROVIDER_ID,
                title: 'Servicio público',
                description: 'Descripción pública',
                category: 'eventos',
                price: 12000,
                is_active: true,
                moderation_status: 'approved',
                categories_json: [],
                change_revision_id: REVISION_ID,
                change_revision_status: 'pending',
                change_review_scope: 'targeted',
                change_pending_fields: ['video_url'],
                change_review_reasons: [{ field: 'video_url', code: 'MEDIA_CHANGED' }],
                change_proposed_snapshot: {
                    title: 'Servicio público',
                    description: 'Descripción pública',
                    category: 'eventos',
                    price: 12000,
                    video_url: '/uploads/new-video.mp4'
                }
            }]
        };
    };

    const res = responseRecorder();
    await getMyServices({ user: { id: PROVIDER_ID } }, res, (error) => { throw error; });

    assert.match(queryText, /LEFT JOIN LATERAL/);
    assert.equal(res.body.services[0].status, 'active');
    assert.equal(res.body.services[0].videoUrl, '/uploads/new-video.mp4');
    assert.equal(res.body.services[0].review.revisionId, REVISION_ID);
    assert.deepEqual(res.body.services[0].review.changedFields, ['video_url']);
});

test('returns the moderator explanation for a rejected proposal without flagging the public Service', async () => {
    pool.query = async () => ({
        rows: [{
            id: SERVICE_ID,
            provider_id: PROVIDER_ID,
            title: 'Servicio público',
            category: 'eventos',
            price: 12000,
            is_active: true,
            moderation_status: 'approved',
            categories_json: [],
            change_revision_id: REVISION_ID,
            change_revision_status: 'rejected',
            change_review_scope: 'targeted',
            change_pending_fields: ['video_url'],
            change_review_reasons: [],
            change_proposed_snapshot: { video_url: '/uploads/rejected.mp4' },
            change_reason_comment: 'El video no permite verificar el servicio.'
        }]
    });

    const res = responseRecorder();
    await getMyServices({ user: { id: PROVIDER_ID } }, res, (error) => { throw error; });

    assert.equal(res.body.services[0].status, 'active');
    assert.equal(res.body.services[0].review.status, 'rejected');
    assert.equal(res.body.services[0].review.reason, 'El video no permite verificar el servicio.');
});
