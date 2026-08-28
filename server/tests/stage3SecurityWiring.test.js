import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('provider service mutations require provider role and current verification', () => {
    const routes = read('server/routes/serviceRoute.js');
    assert.match(routes, /router\.post\('\/', authenticateToken, requireRole\('provider'\), requireVerified, createService\)/);
    assert.match(routes, /router\.put\('\/:id', authenticateToken, requireRole\('provider'\), requireVerified, updateService\)/);
    assert.match(routes, /router\.patch\('\/:id\/status', authenticateToken, requireRole\('provider'\), requireVerified, updateServicePublicationStatus\)/);
    assert.match(routes, /router\.post\('\/promotions', authenticateToken, requireRole\('provider'\), requireVerified, createPromotion\)/);
});

test('provider status changes persist only for approved services without resetting moderation', () => {
    const controller = read('server/controllers/serviceController.js');
    const providerServices = read('src/components/provider/views/ProviderServices.tsx');
    const serviceList = read('src/components/provider/services/ServiceList.tsx');
    const handler = controller.match(/export const updateServicePublicationStatus[\s\S]*?\n};/)?.[0] || '';

    assert.match(handler, /typeof isActive !== 'boolean'/);
    assert.match(handler, /service\.provider_id !== userId/);
    assert.match(handler, /service\.moderation_status !== 'approved'/);
    assert.match(handler, /AND moderation_status = 'approved'/);
    assert.match(handler, /SET is_active = \$1/);
    assert.doesNotMatch(handler, /moderation_status = 'pending'/);
    assert.match(providerServices, /`\/services\/\$\{serviceId\}\/status`/);
    assert.match(providerServices, /\{ is_active: isActive \}/);
    assert.match(serviceList, /disabled=\{service\.moderation_status !== 'approved'/);
});

test('provider and freight routes enforce provider role at the route boundary', () => {
    const providerRoutes = read('server/routes/providerRoute.js');
    const freightRoutes = read('server/routes/freightRoute.js');

    assert.match(providerRoutes, /authenticateToken, requireRole\('provider'\), getProfile/);
    assert.match(providerRoutes, /authenticateToken, requireRole\('provider'\), requireVerified, getFinanceDetails/);
    assert.match(freightRoutes, /authenticateToken, requireRole\('provider'\), requireVerified, addVehicle/);
    assert.match(freightRoutes, /authenticateToken, requireRole\('provider'\), requireVerified, updateVehicle/);
    assert.match(freightRoutes, /authenticateToken, requireRole\('provider'\), requireVerified, deleteVehicle/);
});

test('public services use an allowlisted DTO and verified, unblocked providers', () => {
    const controller = read('server/controllers/serviceController.js');
    const providerController = read('server/controllers/providerController.js');

    assert.match(controller, /service:\s*toPublicServiceDto\(\{\s*\.\.\.result\.rows\[0\],/);
    assert.match(controller, /result\.rows\.map\(row => toPublicServiceDto\(/);
    assert.match(controller, /p\.is_verified = true AND COALESCE\(u\.is_blocked, false\) = false/);
    assert.match(providerController, /pp\.is_verified = TRUE AND COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
    assert.doesNotMatch(providerController, /name: profile\.full_name \|\| profile\.email/);
});

test('checkout obtains public totals without reading commission configuration', () => {
    const routes = read('server/routes/serviceRoute.js');
    const quoteController = read('server/controllers/publicServiceQuoteController.js');
    const checkout = read('src/components/public/CheckoutPage.tsx');
    const detail = read('src/components/public/ServiceDetailPage.tsx');

    assert.ok(routes.indexOf("router.get('/:id/quote'") < routes.indexOf("router.get('/:id'"));
    assert.match(quoteController, /baseAmount: pricing\.baseAmount/);
    assert.match(quoteController, /serviceFee: pricing\.platformFee/);
    assert.match(quoteController, /totalAmount: pricing\.totalAmount/);
    assert.match(quoteController, /p\.is_verified = TRUE/);
    assert.match(quoteController, /COALESCE\(u\.is_blocked, FALSE\) = FALSE/);
    assert.match(checkout, /api\.get\(`\/services\/\$\{service\.id\}\/quote`/);
    assert.doesNotMatch(checkout, /service\?\.commission_percentage/);
    assert.doesNotMatch(checkout, /service\?\.commission_type/);
    assert.doesNotMatch(detail, /commission_percentage|commission_type|fixed_commission/);
});

test('uploads apply quotas, field contracts, signature checks and rejection cleanup', () => {
    const serviceRoutes = read('server/routes/serviceRoute.js');
    const providerRoutes = read('server/routes/providerRoute.js');
    const providerController = read('server/controllers/providerController.js');

    assert.match(serviceRoutes, /serviceVideoUploadLimiter, cleanupRejectedUploads, videoUpload\.single\('video'\), validateVideoUpload, validateUploadedFileSignatures/);
    assert.match(serviceRoutes, /serviceMediaUploadLimiter, cleanupRejectedUploads, upload\.single\('cover'\), validateCoverUpload, validateUploadedFileSignatures/);
    assert.match(providerRoutes, /providerProfileUploadLimiter/);
    assert.match(providerRoutes, /cleanupRejectedUploads/);
    assert.match(providerRoutes, /validateProviderProfileUpload/);
    assert.match(providerRoutes, /validateUploadedFileSignatures/);
    assert.match(providerController, /code: 'INVALID_KYC_FIELD'/);
});

test('public idea submission is rate limited, bounded and HTML escaped', () => {
    const routes = read('server/routes/publicRoute.js');

    assert.match(routes, /router\.post\('\/idea', ideaLimiter/);
    assert.match(routes, /ideaName\.length > 120/);
    assert.match(routes, /ideaDesc\.length > 2000/);
    assert.match(routes, /code: 'INVALID_IDEA_SUBMISSION'/);
    assert.match(routes, /const safeIdeaName = escapeHtml\(ideaName\)/);
    assert.match(routes, /const safeIdeaDesc = escapeHtml\(ideaDesc\)/);
});

test('new and edited services require admin moderation before publication', () => {
    const controller = read('server/controllers/serviceController.js');
    const adminRoutes = read('server/routes/adminRoute.js');
    const migration = read('server/scripts/migrations/add_service_moderation.sql');

    assert.match(controller, /false, 'pending'/);
    assert.match(controller, /moderation_status = 'pending'/);
    assert.match(controller, /s\.moderation_status = 'approved'/);
    assert.match(controller, /export const moderateService/);
    assert.match(adminRoutes, /router\.patch\('\/services\/:id\/moderation', moderateService\)/);
    assert.match(migration, /services_moderation_status_check/);
    assert.match(migration, /idx_services_public_catalog/);
});

test('public catalog bounds query work and cache cardinality', () => {
    const controller = read('server/controllers/serviceController.js');
    const cacheMiddleware = read('server/middleware/cacheMiddleware.js');
    const cacheService = read('server/services/cacheService.js');

    assert.match(controller, /pageSize > 100/);
    assert.match(controller, /query \+= ` LIMIT \$\$\{params\.length - 1\} OFFSET \$\$\{params\.length\}`/);
    assert.match(controller, /code: 'INVALID_SERVICE_QUERY'/);
    assert.match(cacheMiddleware, /new URLSearchParams\(\)/);
    assert.match(cacheMiddleware, /rawUrl\.length > 2048/);
    assert.match(cacheService, /maxKeys: 1000/);
});
