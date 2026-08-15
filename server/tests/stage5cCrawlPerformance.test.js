import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
    buildProviderPath,
    buildServicePath,
    extractPublicUuid,
    slugifyPublicPathSegment
} from '../../shared/publicPaths.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(testDirectory, '..', '..');
const readSource = (...segments) => fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
const PUBLIC_ID = '33333333-3333-4333-8333-333333333333';

test('public detail helpers build readable, bounded, reversible canonical paths', () => {
    assert.equal(slugifyPublicPathSegment('  Gasfitería & Mantención <Urgente>  '), 'gasfiteria-mantencion-urgente');
    assert.equal(buildServicePath(PUBLIC_ID, 'Gasfitería & Mantención'), `/service/gasfiteria-mantencion-${PUBLIC_ID}`);
    assert.equal(buildProviderPath(PUBLIC_ID, 'Ángela Servicios SpA'), `/provider/angela-servicios-spa-${PUBLIC_ID}`);
    assert.equal(extractPublicUuid(`gasfiteria-mantencion-${PUBLIC_ID}`), PUBLIC_ID);
    assert.equal(buildServicePath('invalido', 'Servicio'), '/categories');
});

test('public discovery navigation is represented by real links', () => {
    const header = readSource('src', 'components', 'Header.tsx');
    const footer = readSource('src', 'components', 'Footer.tsx');
    const serviceCard = readSource('src', 'components', 'ServiceCard.tsx');
    const providerProfile = readSource('src', 'components', 'public', 'ProviderPublicProfile.tsx');
    const serviceDetail = readSource('src', 'components', 'public', 'ServiceDetailPage.tsx');
    const categories = readSource('src', 'components', 'public', 'CategoriesHubPage.tsx');

    assert.ok(header.includes('<Link to="/"'));
    assert.ok(header.includes('<Link to="/search"'));
    assert.ok(header.includes('<Link to="/categories"'));
    assert.ok(footer.includes('<Link to="/legal/politica-de-privacidad"'));
    assert.ok(serviceCard.includes('<Link to={servicePath}'));
    assert.ok(providerProfile.includes('to={buildServicePath(service.id, service.title)}'));
    assert.ok(serviceDetail.includes('to={buildProviderPath(service.provider.id, service.provider.name)}'));
    assert.ok(categories.includes('to={getCategoryPath(category)}'));
    assert.doesNotMatch(serviceCard, /onClick=.*service-detail/);
    assert.doesNotMatch(providerProfile, /onClick=.*service-detail/);
    assert.doesNotMatch(serviceDetail, /onClick=.*provider-profile/);
});

test('homepage role videos remain opt-in, lightweight and text-explained', () => {
    const homepage = readSource('src', 'components', 'HomePage.tsx');
    const videos = homepage.match(/<video\b[\s\S]*?\/>/g) || [];

    assert.equal(videos.length, 2);
    for (const video of videos) {
        assert.match(video, /poster="\/videos\/[a-z-]+\.webp"/);
        assert.match(video, /preload="none"/);
        assert.match(video, /controls/);
        assert.match(video, /width=\{960\}/);
        assert.match(video, /height=\{720\}/);
        assert.doesNotMatch(video, /\bautoPlay\b/);
        assert.doesNotMatch(video, /\bloop\b/);
    }
    assert.match(homepage, /<details[\s\S]*Descripción textual del video/);
    assert.match(homepage, /subtítulos visibles en español/);
});

test('direct public images reserve layout space and declare asynchronous decoding', () => {
    const sourceFiles = [
        ['src', 'components', 'HomePage.tsx'],
        ['src', 'components', 'ServiceCard.tsx'],
        ['src', 'components', 'public', 'CategoriesHubPage.tsx'],
        ['src', 'components', 'public', 'CheckoutPage.tsx'],
        ['src', 'components', 'public', 'ProviderPublicProfile.tsx'],
        ['src', 'components', 'public', 'ServiceDetailPage.tsx']
    ];

    for (const segments of sourceFiles) {
        const source = readSource(...segments);
        const imageTags = source.match(/<img\b[\s\S]*?\/>/g) || [];
        assert.ok(imageTags.length > 0, segments.join('/'));
        for (const imageTag of imageTags) {
            assert.match(imageTag, /\bwidth=/, segments.join('/'));
            assert.match(imageTag, /\bheight=/, segments.join('/'));
            assert.match(imageTag, /\bdecoding="async"/, segments.join('/'));
        }
    }
});
