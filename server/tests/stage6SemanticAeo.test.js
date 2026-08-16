import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { injectPublicSsr } from '../ssr/entryServer.js';
import { loadPublicRouteDocument, loadPublicSitemapPaths } from '../services/publicRouteManifest.js';
import { injectSeoMetadata } from '../services/seoService.js';
import { buildPublicStructuredData, serializeStructuredData } from '../services/structuredData.js';
import { sanitizePublicServiceFeatures, toPublicServiceDto } from '../utils/publicDtos.js';
import { parsePublicServiceDescription } from '../../shared/publicContent.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(testDirectory, '..', '..');
const origin = 'https://serviciosatuhogar.cl/';
const servicePath = '/service/gasfiteria-33333333-3333-4333-8333-333333333333';
const canonical = new URL(servicePath, origin).toString();

const serviceDocument = {
    status: 200,
    indexable: true,
    canonical,
    page: {
        kind: 'service',
        routeId: 'service',
        heading: 'Gasfitería domiciliaria',
        description: 'Reparación de filtraciones.',
        fullDescription: 'Reparación de filtraciones y artefactos.',
        price: 45000,
        priceCurrency: 'CLP',
        serviceType: 'presencial',
        scope: 'Santiago',
        lastUpdated: '2026-08-15',
        provider: {
            name: 'Ana Servicios',
            href: '/provider/ana-servicios-11111111-1111-4111-8111-111111111111'
        },
        breadcrumbs: [
            { href: '/', label: 'Inicio' },
            { href: '/categories', label: 'Categorías' },
            { label: 'Gasfitería domiciliaria' }
        ]
    }
};

test('service description parser removes authoring syntax and empty placeholders', () => {
    const parsed = parsePublicServiceDescription(`**Resumen breve:** Servicio de reparación.

**Qué incluye:**
- Diagnóstico
- [Prestación pendiente]

**Requisitos previos:**
[Indica qué debe tener listo el cliente]`);

    assert.equal(parsed.plainText, 'Servicio de reparación. Diagnóstico');
    assert.deepEqual(parsed.sections, [
        {
            heading: 'Resumen breve',
            paragraphs: ['Servicio de reparación.'],
            items: []
        },
        {
            heading: 'Qué incluye',
            paragraphs: [],
            items: ['Diagnóstico']
        }
    ]);
    assert.doesNotMatch(JSON.stringify(parsed), /\*\*|\[Indica|\[Prestación/);
});

test('public DTO removes platform guarantees and keeps factual service features', () => {
    const features = sanitizePublicServiceFeatures(JSON.stringify([
        'Trae sus propios materiales',
        'Garantía de satisfacción',
        'Seguro contra daños',
        'Pago Seguro',
        'Pet Friendly'
    ]));

    assert.deepEqual(features, ['Trae sus propios materiales', 'Pet Friendly']);
    assert.deepEqual(toPublicServiceDto({ id: 'service-1', features }), {
        id: 'service-1',
        features: ['Trae sus propios materiales', 'Pet Friendly']
    });
});

test('structured data uses stable IDs and only visible real service facts', () => {
    const structuredData = buildPublicStructuredData({ document: serviceDocument, siteOrigin: origin });
    const serialized = serializeStructuredData(structuredData);
    const graph = structuredData['@graph'];
    const service = graph.find((node) => node['@type'] === 'Service');
    const offer = graph.find((node) => node['@type'] === 'Offer');
    const breadcrumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');

    assert.equal(service['@id'], `${canonical}#service`);
    assert.equal(service.areaServed, 'Santiago');
    assert.equal(service.dateModified, '2026-08-15');
    assert.equal(offer['@id'], `${canonical}#offer`);
    assert.equal(offer.price, '45000');
    assert.equal(offer.priceCurrency, 'CLP');
    assert.equal(breadcrumbs.itemListElement.at(-1).item, canonical);
    assert.equal(serialized.includes('<'), false);
    assert.equal(serialized.includes('AggregateRating'), false);
    assert.equal(serialized.includes('ratingValue'), false);
});

test('metadata injection emits one inert JSON-LD block and escapes closing tags', () => {
    const unsafeDocument = {
        ...serviceDocument,
        page: { ...serviceDocument.page, heading: '</script><script>alert(1)</script>' }
    };
    const structuredData = buildPublicStructuredData({ document: unsafeDocument, siteOrigin: origin });
    const shell = '<!doctype html><html><head><title>Old</title></head><body><div id="root"></div></body></html>';
    const seo = {
        title: 'Servicio',
        description: 'Descripción',
        robots: 'index, follow',
        canonical,
        image: new URL('/images/logo-sath-26.png', origin).toString(),
        type: 'website',
        structuredData
    };
    const once = injectSeoMetadata(shell, seo);
    const twice = injectSeoMetadata(once, seo);

    assert.equal((twice.match(/id="seo-structured-data"/g) || []).length, 1);
    assert.match(twice, /type="application\/ld\+json"/);
    assert.equal(twice.includes('</script><script>alert(1)</script>'), false);
    assert.match(twice, /\\u003c\/script\\u003e/);
});

test('empty category is noindex and omitted from the dynamic sitemap', async () => {
    const emptyDb = { pool: { query: async () => ({ rows: [] }) } };
    const document = await loadPublicRouteDocument({ db: emptyDb, pathname: '/categories/hogar' });
    assert.equal(document.status, 200);
    assert.equal(document.indexable, false);

    const sitemapDb = {
        pool: {
            query: async (sql) => {
                if (/FROM platform_settings/.test(sql)) return { rows: [] };
                if (/SELECT DISTINCT s\.category/.test(sql)) {
                    return { rows: [{ category: 'clases' }, { category: 'categoria-interna' }] };
                }
                if (/SELECT s\.id, s\.title/.test(sql)) return { rows: [] };
                if (/SELECT pp\.user_id AS id/.test(sql)) return { rows: [] };
                throw new Error(`Unexpected query: ${sql}`);
            }
        }
    };
    const paths = await loadPublicSitemapPaths(sitemapDb);
    assert.equal(paths.includes('/categories/clases'), true);
    assert.equal(paths.includes('/categories/hogar'), false);
    assert.equal(paths.includes('/categories/categoria-interna'), false);
});

test('SSR service answer block exposes key questions, disclosure and traceable CTA', () => {
    const page = {
        ...serviceDocument.page,
        priceLabel: '$45.000',
        descriptionSections: [{
            heading: 'Resumen breve',
            paragraphs: ['Reparación de filtraciones y artefactos.'],
            items: []
        }],
        pricingBasis: 'El precio publicado corresponde al servicio descrito.',
        availabilitySummary: 'La disponibilidad se confirma antes de reservar.',
        termsHref: '/legal/terminos-y-condiciones-de-uso'
    };
    const html = injectPublicSsr(
        '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
        page
    );

    assert.match(html, /Resumen breve/);
    assert.match(html, /Precio publicado/);
    assert.match(html, /Cobertura/);
    assert.match(html, /Información actualizada: 2026-08-15/);
    assert.match(html, /data-analytics-event="service_booking_intent"/);
    assert.match(html, /Revisar términos de uso/);
    assert.match(html, /no certifica títulos, especialidades ni resultados/);
    assert.doesNotMatch(html, /\*\*/);
});

test('public source no longer contains the audited simulated trust claims', () => {
    const files = [
        'src/components/HomePage.tsx',
        'src/components/LoginForm.tsx',
        'src/components/public/CategoryDetailPage.tsx',
        'src/components/public/SearchResultsPage.tsx',
        'src/components/public/ServiceDetailPage.tsx',
        'src/components/public/CheckoutPage.tsx',
        'server/controllers/providerController.js'
    ];
    const source = files
        .map((file) => fs.readFileSync(path.join(projectRoot, file), 'utf8'))
        .join('\n');

    for (const forbidden of [
        /rating:\s*5(?:\.0)?/,
        /responseTime:\s*['"]1 hora['"]/,
        /#1 Marketplace/,
        /Rating Prom\./,
        /Garantía Serviciosatuhogar/,
        /Pagos garantizados semanalmente/,
        /Únete a miles de profesionales/
    ]) {
        assert.doesNotMatch(source, forbidden);
    }
});
