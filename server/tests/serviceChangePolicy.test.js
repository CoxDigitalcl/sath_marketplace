import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ServiceChangePolicyError,
    classifyServiceChanges,
} from '../services/serviceChangePolicy.js';

const publicService = {
    title: 'Payaso para cumpleaños infantiles',
    description: 'Animación familiar para cumpleaños y celebraciones.',
    category: 'Eventos',
    price: 5000,
    video_url: 'https://media.example/old.mp4',
    duration_minutes: 60,
    type: 'presencial',
    availability_type: 'agenda',
    calendar_config: { schedule: [] },
    features: ['Globoflexia'],
    image_urls: ['https://media.example/old.jpg'],
    categories_json: ['Eventos'],
    cover_image_url: 'https://media.example/cover.jpg',
    gallery_media: [],
    pricing_type: 'per_event',
    freight_base_price: null,
    freight_price_per_km: null,
    freight_max_distance_km: 1000,
};

test('auto-applies commercial and scheduling changes and marks pricing semantics', () => {
    const result = classifyServiceChanges({
        currentService: publicService,
        proposedChanges: {
            price: 8000,
            pricing_type: 'per_hour',
            duration_minutes: 90,
            availability_type: 'flexible',
            calendar_config: { schedule: [{ day: 'Lunes' }] },
            freight_base_price: 3000,
            freight_price_per_km: 900,
            freight_max_distance_km: 500,
        },
    });

    assert.deepEqual(result.pendingFields, []);
    assert.deepEqual(result.autoAppliedFields, [
        'price',
        'duration_minutes',
        'availability_type',
        'calendar_config',
        'pricing_type',
        'freight_base_price',
        'freight_price_per_km',
        'freight_max_distance_km',
    ]);
    assert.equal(result.reviewScope, 'none');
    assert.equal(result.hasPricingChange, true);
});

test('publishes a small clean text correction but targets risky text for review', () => {
    const typo = classifyServiceChanges({
        currentService: publicService,
        proposedChanges: { description: 'Animación familiar para cumpleaños y celebraciones' },
    });
    assert.deepEqual(typo.autoAppliedFields, ['description']);
    assert.deepEqual(typo.pendingFields, []);

    const contact = classifyServiceChanges({
        currentService: publicService,
        proposedChanges: { description: 'Reserva por WhatsApp al +56 9 1234 5678.' },
    });
    assert.deepEqual(contact.pendingFields, ['description']);
    assert.equal(contact.reviewScope, 'targeted');
    assert.ok(contact.reviewReasons.some(({ code }) => code === 'TEXT_CONTACT_INFORMATION'));
    assert.ok(contact.reviewReasons.some(({ code }) => code === 'TEXT_OFF_PLATFORM_TRANSACTION'));

    const shortReplacement = classifyServiceChanges({
        currentService: { ...publicService, title: 'Clases' },
        proposedChanges: { title: 'Armas' },
    });
    assert.deepEqual(shortReplacement.pendingFields, ['title']);
    assert.ok(shortReplacement.reviewReasons.some(({ code }) => code === 'TEXT_SUBSTANTIAL_CHANGE'));
});

test('classifies large descriptions without quadratic edit-distance work', () => {
    const before = 'a'.repeat(20_000);
    const proposed = 'b'.repeat(20_000);
    const startedAt = performance.now();
    const result = classifyServiceChanges({
        currentService: { ...publicService, description: before },
        proposedChanges: { description: proposed },
    });

    assert.deepEqual(result.pendingFields, ['description']);
    assert.ok(performance.now() - startedAt < 250);
});

test('routes media to targeted review and category or type to full review', () => {
    const result = classifyServiceChanges({
        currentService: publicService,
        proposedChanges: {
            video_url: 'https://media.example/new.mp4',
            category: 'Salud',
            type: 'online',
        },
    });

    assert.deepEqual(result.pendingFields, ['category', 'video_url', 'type']);
    assert.equal(result.reviewScope, 'full');
    assert.ok(result.reviewReasons.some(({ field, code }) =>
        field === 'video_url' && code === 'MEDIA_CHANGED'
    ));
    assert.ok(result.reviewReasons.some(({ field, code }) =>
        field === 'category' && code === 'SERVICE_CLASSIFICATION_CHANGED'
    ));
});

test('fails closed for unknown and reserved fields, including is_active', () => {
    for (const proposedChanges of [{ product_id: 'x' }, { is_active: true }]) {
        assert.throws(
            () => classifyServiceChanges({ currentService: publicService, proposedChanges }),
            (error) => error instanceof ServiceChangePolicyError &&
                error.code === 'UNKNOWN_SERVICE_FIELDS'
        );
    }
});

test('records a new Service as a full review even when values already match the inserted row', () => {
    const result = classifyServiceChanges({
        currentService: publicService,
        proposedChanges: publicService,
        revisionType: 'creation',
    });

    assert.equal(result.reviewScope, 'full');
    assert.deepEqual(result.autoAppliedFields, []);
    assert.ok(result.pendingFields.includes('title'));
    assert.ok(result.pendingFields.includes('price'));
    assert.equal(result.reviewReasons.every(({ code }) => code === 'NEW_SERVICE_REVIEW'), true);
});
