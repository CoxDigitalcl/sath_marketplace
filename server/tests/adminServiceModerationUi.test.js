import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SERVICE_FIELD_POLICY } from '../services/serviceChangePolicy.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(currentDirectory, '..', '..', path), 'utf8');

test('admin Services table fills the available card while preserving its mobile minimum', () => {
    const adminServices = read('src/components/admin/views/AdminServices.tsx');

    assert.match(adminServices, /w-full min-w-\[920px\] table-fixed/);
    assert.match(adminServices, /<colgroup>/);
    assert.match(adminServices, /<caption className="sr-only">/);
    assert.doesNotMatch(adminServices, /min-w-56/);
});

test('moderation criteria remain available in an accessible on-demand drawer', () => {
    const adminServices = read('src/components/admin/views/AdminServices.tsx');
    const drawer = read('src/components/admin/services/ServiceModerationCriteriaDrawer.tsx');

    assert.match(adminServices, /Criterios de moderación/);
    assert.match(adminServices, /aria-haspopup="dialog"/);
    assert.match(drawer, /<Dialog/);
    assert.match(drawer, /initialFocus=\{closeButtonRef\}/);
    assert.match(drawer, /motion-reduce:duration-0/);
    assert.match(drawer, /Publicación automática/);
    assert.match(drawer, /Revisión focalizada/);
    assert.match(drawer, /Revisión completa/);
});

test('the reference covers every class enforced by the Service change policy', () => {
    const byPolicy = (policy) => Object.entries(SERVICE_FIELD_POLICY)
        .filter(([, value]) => value === policy)
        .map(([field]) => field)
        .sort();

    assert.deepEqual(byPolicy('auto_apply'), [
        'availability_type',
        'calendar_config',
        'duration_minutes',
        'freight_base_price',
        'freight_max_distance_km',
        'freight_price_per_km',
        'price',
        'pricing_type'
    ]);
    assert.deepEqual(byPolicy('text_guarded'), ['description', 'features', 'title']);
    assert.deepEqual(byPolicy('targeted_review'), ['cover_image_url', 'gallery_media', 'image_urls', 'video_url']);
    assert.deepEqual(byPolicy('full_review'), ['categories_json', 'category', 'type']);
});

test('legacy Service reviews explain their origin instead of showing artificial differences', () => {
    const modal = read('src/components/admin/services/ServiceRevisionReviewModal.tsx');

    assert.match(modal, /LEGACY_PENDING_REVIEW: 'Servicio pendiente anterior al nuevo sistema'/);
    assert.match(modal, /Revisión inicial de un Servicio existente/);
    assert.match(modal, /No existe un historial confiable para comparar/);
    assert.match(modal, /legacyReview \? \(/);
    assert.match(modal, /setShowFullReview\(isLegacyPendingReview\(normalized\)\)/);
});

test('technical Service values have readable admin representations and explicit media failures', () => {
    const modal = read('src/components/admin/services/ServiceRevisionReviewModal.tsx');
    const videoPlayer = read('src/components/common/VideoPlayer.tsx');

    assert.match(modal, /calendar_config: 'Agenda semanal'/);
    assert.match(modal, /per_event: 'Por servicio o evento'/);
    assert.match(modal, /<WeeklyScheduleValue value=\{value\} \/>/);
    assert.match(modal, /Archivo de \{kind\} no disponible/);
    assert.match(modal, /errorTitle="Archivo de video no disponible"/);
    assert.match(videoPlayer, /errorDescription\?: string/);
});
