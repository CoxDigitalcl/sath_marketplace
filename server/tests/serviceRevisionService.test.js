import assert from 'node:assert/strict';
import test from 'node:test';

import {
    FULL_REVIEW_CHECKLIST_ITEMS,
    ServiceRevisionError,
    createServiceRevisionService,
} from '../services/serviceRevisionService.js';

const SERVICE_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const REVISION_ID = '44444444-4444-4444-8444-444444444444';

const baseService = {
    id: SERVICE_ID,
    provider_id: PROVIDER_ID,
    title: 'Payaso para cumpleaños',
    description: 'Animación familiar.',
    category: 'Eventos',
    price: 5000,
    video_url: 'https://media.example/old.mp4',
    is_active: true,
    moderation_status: 'approved',
    duration_minutes: 60,
    type: 'presencial',
    availability_type: 'agenda',
    calendar_config: {},
    features: [],
    image_urls: [],
    categories_json: [],
    cover_image_url: null,
    gallery_media: [],
    pricing_type: 'per_event',
    freight_base_price: null,
    freight_price_per_km: null,
    freight_max_distance_km: 1000,
    pricing_version: 1,
    updated_at: '2026-08-28T12:00:00.000Z',
};

const revisionRow = (overrides = {}) => ({
    id: REVISION_ID,
    service_id: SERVICE_ID,
    provider_id: PROVIDER_ID,
    revision_number: 2,
    revision_type: 'update',
    status: 'pending',
    review_scope: 'targeted',
    before_snapshot: baseService,
    proposed_snapshot: { ...baseService, video_url: 'https://media.example/new.mp4' },
    changed_fields: ['video_url'],
    auto_applied_fields: [],
    pending_fields: ['video_url'],
    review_reasons: [{ field: 'video_url', code: 'MEDIA_CHANGED' }],
    base_service_updated_at: baseService.updated_at,
    created_at: baseService.updated_at,
    updated_at: baseService.updated_at,
    applied_at: null,
    decided_at: null,
    superseded_at: null,
    ...overrides,
});

const createHarness = (resolver) => {
    const calls = [];
    let released = false;
    const client = {
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/gu, ' ').trim();
            calls.push({ sql: normalized, params });
            if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
                return { rows: [] };
            }
            return resolver(normalized, params, calls);
        },
        release() {
            released = true;
        },
    };
    const pool = {
        query: (...args) => client.query(...args),
        async connect() {
            return client;
        },
    };
    return { pool, calls, wasReleased: () => released };
};

test('auto-applies a price atomically, increments pricing_version once and records an applied revision', async () => {
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT * FROM services') && sql.includes('FOR UPDATE')) {
            return { rows: [{ ...baseService }] };
        }
        if (sql.startsWith('SELECT * FROM service_revisions')) {
            return { rows: [] };
        }
        if (sql.startsWith('UPDATE services SET')) {
            assert.match(sql, /price = \$1/);
            assert.match(sql, /pricing_version = pricing_version \+ 1/);
            return { rows: [{ ...baseService, price: params[0], pricing_version: 2 }] };
        }
        if (sql.startsWith('SELECT COALESCE(MAX(revision_number)')) {
            return { rows: [{ next_revision_number: '2' }] };
        }
        if (sql.startsWith('INSERT INTO service_revisions')) {
            return {
                rows: [revisionRow({
                    status: params[4],
                    review_scope: params[5],
                    before_snapshot: JSON.parse(params[6]),
                    proposed_snapshot: JSON.parse(params[7]),
                    changed_fields: params[8],
                    auto_applied_fields: params[9],
                    pending_fields: params[10],
                    review_reasons: JSON.parse(params[11]),
                    applied_at: baseService.updated_at,
                })],
            };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.recordServiceChanges({
        serviceId: SERVICE_ID,
        providerId: PROVIDER_ID,
        proposedChanges: { price: 8000 },
        expectedRevisionId: null,
    });

    assert.equal(result.outcome, 'applied');
    assert.deepEqual(result.appliedFields, ['price']);
    assert.deepEqual(result.pendingFields, []);
    assert.equal(result.service.pricingVersion, 2);
    assert.equal(result.revision.status, 'applied');
    assert.equal(harness.calls.at(-1).sql, 'COMMIT');
    assert.equal(harness.wasReleased(), true);
});

test('casts JSON Service fields explicitly when applying them to PostgreSQL', async () => {
    const schedule = { schedule: [{ day: 'Lunes', active: true, timeRanges: [] }] };
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [] };
        if (sql.startsWith('UPDATE services SET')) {
            assert.match(sql, /calendar_config = \$1::jsonb/);
            assert.equal(params[0], JSON.stringify(schedule));
            return { rows: [{ ...baseService, calendar_config: schedule }] };
        }
        if (sql.startsWith('SELECT COALESCE(MAX(revision_number)')) {
            return { rows: [{ next_revision_number: 2 }] };
        }
        if (sql.startsWith('INSERT INTO service_revisions')) {
            return { rows: [revisionRow({
                status: params[4],
                review_scope: params[5],
                before_snapshot: JSON.parse(params[6]),
                proposed_snapshot: JSON.parse(params[7]),
                changed_fields: params[8],
                auto_applied_fields: params[9],
                pending_fields: params[10],
                review_reasons: JSON.parse(params[11]),
            })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.recordServiceChanges({
        serviceId: SERVICE_ID,
        providerId: PROVIDER_ID,
        proposedChanges: { calendar_config: schedule },
        expectedRevisionId: null,
    });

    assert.equal(result.outcome, 'applied');
    assert.deepEqual(result.appliedFields, ['calendar_config']);
});

test('leaves media public state untouched and creates a targeted pending revision', async () => {
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [] };
        if (sql.startsWith('SELECT COALESCE(MAX(revision_number)')) {
            return { rows: [{ next_revision_number: 2 }] };
        }
        if (sql.startsWith('INSERT INTO service_revisions')) {
            return { rows: [revisionRow({
                status: params[4],
                review_scope: params[5],
                before_snapshot: JSON.parse(params[6]),
                proposed_snapshot: JSON.parse(params[7]),
                changed_fields: params[8],
                auto_applied_fields: params[9],
                pending_fields: params[10],
                review_reasons: JSON.parse(params[11]),
            })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.recordServiceChanges({
        serviceId: SERVICE_ID,
        providerId: PROVIDER_ID,
        proposedChanges: { video_url: 'https://media.example/new.mp4' },
        expectedRevisionId: null,
    });

    assert.equal(result.outcome, 'review_required');
    assert.deepEqual(result.appliedFields, []);
    assert.deepEqual(result.pendingFields, ['video_url']);
    assert.equal(result.service.isActive, true);
    assert.equal(harness.calls.some(({ sql }) => sql.startsWith('UPDATE services SET')), false);
});

test('rejects stale provider writes and rolls back without superseding the current revision', async () => {
    const harness = createHarness((sql) => {
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [revisionRow()] };
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    await assert.rejects(
        service.recordServiceChanges({
            serviceId: SERVICE_ID,
            providerId: PROVIDER_ID,
            proposedChanges: { price: 7000 },
            expectedRevisionId: '55555555-5555-4555-8555-555555555555',
        }),
        (error) => error instanceof ServiceRevisionError &&
            error.code === 'SERVICE_REVISION_STALE' && error.statusCode === 409
    );
    assert.equal(harness.calls.some(({ sql }) => sql.startsWith('UPDATE service_revisions SET')), false);
    assert.equal(harness.calls.at(-1).sql, 'ROLLBACK');
});

test('creates the Service and its full initial revision in one transaction', async () => {
    const pendingService = { ...baseService, is_active: false, moderation_status: 'pending' };
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('INSERT INTO services')) return { rows: [pendingService] };
        if (sql.startsWith('INSERT INTO service_revisions')) {
            return { rows: [revisionRow({
                revision_number: 1,
                revision_type: 'creation',
                review_scope: 'full',
                changed_fields: params[4],
                auto_applied_fields: params[5],
                pending_fields: params[6],
                review_reasons: JSON.parse(params[7]),
                before_snapshot: JSON.parse(params[2]),
                proposed_snapshot: JSON.parse(params[3]),
            })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.createServiceWithInitialRevision({
        providerId: PROVIDER_ID,
        proposedChanges: {
            title: baseService.title,
            category: baseService.category,
            price: baseService.price,
            description: baseService.description,
        },
    });

    assert.equal(result.outcome, 'review_required');
    assert.equal(result.service.isActive, false);
    assert.equal(result.revision.revisionType, 'creation');
    assert.equal(result.revision.reviewScope, 'full');
    assert.ok(result.pendingFields.includes('title'));
    assert.deepEqual(harness.calls.map(({ sql }) => sql).filter((sql) =>
        ['BEGIN', 'COMMIT'].includes(sql)
    ), ['BEGIN', 'COMMIT']);
});

test('resubmitting a rejected creation preserves full creation review semantics', async () => {
    const rejectedService = { ...baseService, is_active: false, moderation_status: 'rejected' };
    const rejectedCreation = revisionRow({
        revision_number: 1,
        revision_type: 'creation',
        status: 'rejected',
        review_scope: 'full',
    });
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT * FROM services')) return { rows: [rejectedService] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [rejectedCreation] };
        if (sql.startsWith('UPDATE services SET')) {
            assert.match(sql, /moderation_status = 'pending'/);
            return { rows: [{ ...rejectedService, moderation_status: 'pending' }] };
        }
        if (sql.startsWith('SELECT COALESCE(MAX(revision_number)')) return { rows: [{ next_revision_number: 2 }] };
        if (sql.startsWith('INSERT INTO service_revisions')) {
            assert.equal(params[3], 'creation');
            assert.equal(params[5], 'full');
            return { rows: [revisionRow({
                revision_number: 2,
                revision_type: params[3],
                status: params[4],
                review_scope: params[5],
                before_snapshot: JSON.parse(params[6]),
                proposed_snapshot: JSON.parse(params[7]),
                changed_fields: params[8],
                auto_applied_fields: params[9],
                pending_fields: params[10],
                review_reasons: JSON.parse(params[11]),
            })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.recordServiceChanges({
        serviceId: SERVICE_ID,
        providerId: PROVIDER_ID,
        proposedChanges: { description: 'Descripción corregida y verificable.' },
        expectedRevisionId: null,
    });

    assert.equal(result.outcome, 'review_required');
    assert.equal(result.revision.revisionType, 'creation');
    assert.equal(result.revision.reviewScope, 'full');
    assert.equal(result.service.moderationStatus, 'pending');
});

test('approval promotes exactly the pending update without activating an existing Service', async () => {
    const pendingRevision = revisionRow();
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) {
            return { rows: [{ service_id: SERVICE_ID }] };
        }
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService, is_active: false }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [pendingRevision] };
        if (sql.startsWith('UPDATE services SET')) {
            assert.doesNotMatch(sql, /is_active = TRUE/);
            return { rows: [{
                ...baseService,
                is_active: false,
                video_url: params[0],
                moderated_by: ADMIN_ID,
            }] };
        }
        if (sql.startsWith('INSERT INTO service_revision_decisions')) return { rows: [] };
        if (sql.startsWith('UPDATE service_revisions SET')) {
            return { rows: [revisionRow({ status: params[0], decided_at: baseService.updated_at })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.decideRevision({
        revisionId: REVISION_ID,
        expectedRevisionId: REVISION_ID,
        adminId: ADMIN_ID,
        decision: 'approved',
    });

    assert.equal(result.revision.status, 'approved');
    assert.equal(result.service.isActive, false);
    assert.equal(result.service.providerId, PROVIDER_ID);
    assert.equal(result.service.title, baseService.title);
});

test('approval fails closed when a reviewed local media file no longer exists', async () => {
    const missingUrl = '/uploads/video-missing.mp4';
    const pendingRevision = revisionRow({
        proposed_snapshot: { ...baseService, video_url: missingUrl },
    });
    const harness = createHarness((sql) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) {
            return { rows: [{ service_id: SERVICE_ID }] };
        }
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [pendingRevision] };
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const checkedUrls = [];
    const service = createServiceRevisionService({
        pool: harness.pool,
        mediaExists: (url) => {
            checkedUrls.push(url);
            return false;
        },
    });

    await assert.rejects(
        service.decideRevision({
            revisionId: REVISION_ID,
            expectedRevisionId: REVISION_ID,
            adminId: ADMIN_ID,
            decision: 'approved',
        }),
        (error) => error instanceof ServiceRevisionError &&
            error.code === 'SERVICE_MEDIA_UNAVAILABLE' &&
            error.statusCode === 409 &&
            error.details.fields.includes('video_url')
    );
    assert.deepEqual(checkedUrls, [missingUrl]);
    assert.equal(harness.calls.some(({ sql }) => sql.startsWith('UPDATE services SET')), false);
    assert.equal(harness.calls.at(-1).sql, 'ROLLBACK');
});

test('approval does not recheck unchanged media during a classification-only review', async () => {
    const pendingRevision = revisionRow({
        review_scope: 'full',
        pending_fields: ['category'],
        changed_fields: ['category'],
        proposed_snapshot: {
            ...baseService,
            category: 'Celebraciones',
            video_url: '/uploads/old-missing-video.mp4',
        },
    });
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) return { rows: [{ service_id: SERVICE_ID }] };
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [pendingRevision] };
        if (sql.startsWith('UPDATE services SET')) {
            return { rows: [{ ...baseService, category: params[0] }] };
        }
        if (sql.startsWith('INSERT INTO service_revision_decisions')) return { rows: [] };
        if (sql.startsWith('UPDATE service_revisions SET')) return { rows: [{ ...pendingRevision, status: params[0] }] };
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({
        pool: harness.pool,
        mediaExists: () => {
            throw new Error('Unchanged media must not be checked.');
        },
    });

    const result = await service.decideRevision({
        revisionId: REVISION_ID,
        expectedRevisionId: REVISION_ID,
        adminId: ADMIN_ID,
        decision: 'approved',
        checklistItems: FULL_REVIEW_CHECKLIST_ITEMS,
    });

    assert.equal(result.revision.status, 'approved');
    assert.equal(result.service.isActive, true);
});

test('does not allow a second admin decision after corrections were requested', async () => {
    const harness = createHarness((sql) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) {
            return { rows: [{ service_id: SERVICE_ID }] };
        }
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) {
            return { rows: [revisionRow({ status: 'correction_requested' })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    await assert.rejects(
        service.decideRevision({
            revisionId: REVISION_ID,
            expectedRevisionId: REVISION_ID,
            adminId: ADMIN_ID,
            decision: 'approved',
        }),
        (error) => error instanceof ServiceRevisionError &&
            error.code === 'SERVICE_REVISION_STALE' && error.statusCode === 409
    );
    assert.equal(harness.calls.some(({ sql }) => sql.startsWith('INSERT INTO service_revision_decisions')), false);
    assert.equal(harness.calls.at(-1).sql, 'ROLLBACK');
});

test('admin list returns only summary metadata while detail exposes the effective snapshot', async () => {
    const row = {
        ...revisionRow(),
        service_title: baseService.title,
        service_is_active: true,
        service_moderation_status: 'approved',
        service_pricing_version: '1',
        provider_name: 'Proveedor de prueba',
        total_items: '1',
    };
    const calls = [];
    const pool = {
        async query(sql, params) {
            const normalized = String(sql).replace(/\s+/gu, ' ').trim();
            calls.push({ sql: normalized, params });
            return { rows: [row] };
        },
    };
    const service = createServiceRevisionService({ pool });

    const list = await service.listPendingRevisions({ page: 1, pageSize: 10, search: 'Payaso' });
    assert.equal(list.data.length, 1);
    assert.equal(Object.hasOwn(list.data[0], 'beforeSnapshot'), false);
    assert.equal(Object.hasOwn(list.data[0], 'proposedSnapshot'), false);
    assert.deepEqual(list.pagination, { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    assert.deepEqual(calls[0].params, ['%Payaso%', 10, 0]);

    const detail = await service.getRevisionById({ revisionId: REVISION_ID });
    assert.equal(detail.provider.name, 'Proveedor de prueba');
    assert.equal(detail.effectiveSnapshot.video_url, 'https://media.example/new.mp4');
    assert.equal(detail.service.pricingVersion, 1);
});

test('approval activates a creation revision as a deliberate exception', async () => {
    const creationRevision = revisionRow({
        revision_number: 1,
        revision_type: 'creation',
        review_scope: 'full',
        pending_fields: ['title'],
        changed_fields: ['title'],
    });
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) {
            return { rows: [{ service_id: SERVICE_ID }] };
        }
        if (sql.startsWith('SELECT * FROM services')) {
            return { rows: [{ ...baseService, is_active: false, moderation_status: 'pending' }] };
        }
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [creationRevision] };
        if (sql.startsWith('UPDATE services SET')) {
            assert.match(sql, /is_active = TRUE/);
            return { rows: [{ ...baseService, title: params[0], is_active: true }] };
        }
        if (sql.startsWith('INSERT INTO service_revision_decisions')) return { rows: [] };
        if (sql.startsWith('UPDATE service_revisions SET')) {
            return { rows: [{ ...creationRevision, status: 'approved' }] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.decideRevision({
        revisionId: REVISION_ID,
        expectedRevisionId: REVISION_ID,
        adminId: ADMIN_ID,
        decision: 'approved',
        checklistItems: FULL_REVIEW_CHECKLIST_ITEMS,
    });

    assert.equal(result.service.isActive, true);
});

test('requires the complete server checklist before approving a full review', async () => {
    const creationRevision = revisionRow({
        revision_type: 'creation',
        review_scope: 'full',
        pending_fields: ['title'],
        changed_fields: ['title'],
    });
    const harness = createHarness((sql) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) return { rows: [{ service_id: SERVICE_ID }] };
        if (sql.startsWith('SELECT * FROM services')) return { rows: [{ ...baseService, is_active: false, moderation_status: 'pending' }] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [creationRevision] };
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    await assert.rejects(
        service.decideRevision({
            revisionId: REVISION_ID,
            expectedRevisionId: REVISION_ID,
            adminId: ADMIN_ID,
            decision: 'approved',
            checklistItems: ['information_verified'],
        }),
        (error) => error instanceof ServiceRevisionError &&
            error.code === 'FULL_REVIEW_CHECKLIST_REQUIRED' && error.statusCode === 400
    );
    assert.equal(harness.calls.some(({ sql }) => sql.startsWith('UPDATE services SET')), false);
    assert.equal(harness.calls.at(-1).sql, 'ROLLBACK');
});

test('rejecting an unpublished Service updates its publication status without affecting approved listings', async () => {
    const pendingService = { ...baseService, is_active: false, moderation_status: 'pending' };
    const harness = createHarness((sql, params) => {
        if (sql.startsWith('SELECT service_id FROM service_revisions')) {
            return { rows: [{ service_id: SERVICE_ID }] };
        }
        if (sql.startsWith('SELECT * FROM services')) return { rows: [pendingService] };
        if (sql.startsWith('SELECT * FROM service_revisions')) return { rows: [revisionRow({ revision_type: 'creation' })] };
        if (sql.startsWith('UPDATE services SET')) {
            assert.match(sql, /moderation_status = 'rejected'/);
            assert.match(sql, /is_active = FALSE/);
            return { rows: [{ ...pendingService, moderation_status: 'rejected', moderation_reason: params[0] }] };
        }
        if (sql.startsWith('INSERT INTO service_revision_decisions')) return { rows: [] };
        if (sql.startsWith('UPDATE service_revisions SET')) {
            return { rows: [revisionRow({ status: params[0], revision_type: 'creation' })] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    });
    const service = createServiceRevisionService({ pool: harness.pool });

    const result = await service.decideRevision({
        revisionId: REVISION_ID,
        expectedRevisionId: REVISION_ID,
        adminId: ADMIN_ID,
        decision: 'rejected',
        reasonCode: 'UNSAFE_CONTENT',
        comment: 'El contenido no permite verificar una prestación segura.',
    });

    assert.equal(result.revision.status, 'rejected');
    assert.equal(result.service.moderationStatus, 'rejected');
    assert.equal(result.service.isActive, false);
});
