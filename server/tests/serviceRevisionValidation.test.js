import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createServiceRevisionSchema,
    serviceRevisionDecisionSchema,
    serviceRevisionListQuerySchema,
    updateServiceRevisionSchema,
} from '../utils/serviceRevisionValidation.js';

const REVISION_ID = '0d4ae10c-2900-4507-8fa9-fa469cee5dce';

test('accepts a bounded Service creation and supplies canonical defaults', () => {
    const result = createServiceRevisionSchema.safeParse({
        title: 'Clases de guitarra',
        category: 'clases',
        price: 15000,
    });

    assert.equal(result.success, true);
    assert.equal(result.data.type, 'online');
    assert.deepEqual(result.data.gallery_media, []);
});

test('rejects reserved and unknown Service fields at the HTTP boundary', () => {
    const creation = createServiceRevisionSchema.safeParse({
        title: 'Servicio',
        category: 'otros',
        price: 5000,
        is_active: true,
    });
    const update = updateServiceRevisionSchema.safeParse({
        price: 6000,
        provider_id: REVISION_ID,
    });

    assert.equal(creation.success, false);
    assert.equal(update.success, false);
});

test('rejects executable media schemes and untrusted remote video hosts', () => {
    const executable = updateServiceRevisionSchema.safeParse({
        cover_image_url: 'javascript:alert(1)',
        expected_revision_id: null,
    });
    const untrustedVideo = updateServiceRevisionSchema.safeParse({
        video_url: 'https://attacker.example/video.mp4',
        expected_revision_id: null,
    });
    const trustedVideo = updateServiceRevisionSchema.safeParse({
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expected_revision_id: null,
    });

    assert.equal(executable.success, false);
    assert.equal(untrustedVideo.success, false);
    assert.equal(trustedVideo.success, true);
});

test('separates provider CAS metadata from valid content changes', () => {
    const result = updateServiceRevisionSchema.safeParse({
        price: 18000,
        expected_revision_id: REVISION_ID,
    });

    assert.equal(result.success, true);
    assert.equal(result.data.expected_revision_id, REVISION_ID);
    assert.equal(result.data.price, 18000);
});

test('requires provider CAS metadata even when no revision is currently expected', () => {
    const omitted = updateServiceRevisionSchema.safeParse({ price: 18000 });
    const explicitNone = updateServiceRevisionSchema.safeParse({ price: 18000, expected_revision_id: null });

    assert.equal(omitted.success, false);
    assert.equal(explicitNone.success, true);
});

test('requires an explicit reason and explanation for correction or rejection decisions', () => {
    const missingReason = serviceRevisionDecisionSchema.safeParse({
        decision: 'rejected',
        expectedRevisionId: REVISION_ID,
    });
    const approved = serviceRevisionDecisionSchema.safeParse({
        decision: 'approved',
        expectedRevisionId: REVISION_ID,
        reviewedFields: ['video_url'],
        checklistItems: [],
    });

    assert.equal(missingReason.success, false);
    assert.equal(approved.success, true);
});

test('bounds the admin revision queue while supporting its largest page', () => {
    const maximum = serviceRevisionListQuerySchema.safeParse({ page: '1', pageSize: '200', status: 'pending' });
    const excessive = serviceRevisionListQuerySchema.safeParse({ page: '1', pageSize: '201' });

    assert.equal(maximum.success, true);
    assert.equal(maximum.data.pageSize, 200);
    assert.equal(excessive.success, false);
});
