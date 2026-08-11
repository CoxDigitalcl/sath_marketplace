import test from 'node:test';
import assert from 'node:assert/strict';

import { requireRole } from '../middleware/authorization.js';
import {
    isAllowedUploadField,
    matchesDeclaredFileType,
    validateUploadedFileFields
} from '../middleware/fileUploadSecurity.js';
import { getPublicProviderName, toPublicServiceDto } from '../utils/publicDtos.js';

const createResponse = () => ({
    statusCode: 200,
    payload: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.payload = payload;
        return this;
    }
});

test('requireRole permits an allowed provider', () => {
    const req = { user: { id: 'provider-1', role: 'provider' } };
    const res = createResponse();
    let called = false;

    requireRole('provider')(req, res, () => { called = true; });

    assert.equal(called, true);
    assert.equal(res.statusCode, 200);
});

test('requireRole blocks a client from provider-only actions', () => {
    const req = { user: { id: 'client-1', role: 'client' } };
    const res = createResponse();
    let called = false;

    requireRole('provider')(req, res, () => { called = true; });

    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.code, 'ROLE_REQUIRED');
});

test('requireRole fails closed when authentication has not populated req.user', () => {
    const res = createResponse();

    requireRole('provider')({}, res, () => assert.fail('next must not be called'));

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.code, 'AUTH_REQUIRED');
});

test('public service DTO strips tax, commission and promotion internals', () => {
    const dto = toPublicServiceDto({
        id: 'service-1',
        title: 'Servicio visible',
        rut: '12.345.678-9',
        email: 'private@example.com',
        commission_percentage: 15,
        commission_type: 'PERCENTAGE',
        fixed_commission: 1000,
        payment_status: 'PAID',
        promotion_start_date: '2026-08-10',
        target_keywords: ['secret-segment']
    });

    assert.deepEqual(dto, { id: 'service-1', title: 'Servicio visible' });
});

test('public provider name never falls back to an email address', () => {
    assert.equal(getPublicProviderName({ store_name: '  Mi Tienda  ', full_name: 'Persona' }), 'Mi Tienda');
    assert.equal(getPublicProviderName({ full_name: 'Persona', email: 'private@example.com' }), 'Persona');
    assert.equal(getPublicProviderName({ email: 'private@example.com' }), 'Proveedor');
});

test('file signature validation accepts valid image and document headers', () => {
    assert.equal(matchesDeclaredFileType('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])), true);
    assert.equal(matchesDeclaredFileType('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
    assert.equal(matchesDeclaredFileType('application/pdf', Buffer.from('%PDF-1.7')), true);
    assert.equal(matchesDeclaredFileType('image/png', Buffer.from('<script>alert(1)</script>')), false);
});

test('file signature validation distinguishes RIFF containers', () => {
    const webp = Buffer.from('RIFF0000WEBP', 'ascii');
    const avi = Buffer.from('RIFF0000AVI ', 'ascii');

    assert.equal(matchesDeclaredFileType('image/webp', webp), true);
    assert.equal(matchesDeclaredFileType('video/x-msvideo', avi), true);
    assert.equal(matchesDeclaredFileType('image/webp', avi), false);
});

test('provider upload field allowlist supports configured KYC names only by prefix', () => {
    const options = { allowedFields: ['profile_image', 'banner_image'], allowedPrefixes: ['kyc_'] };

    assert.equal(isAllowedUploadField('profile_image', options), true);
    assert.equal(isAllowedUploadField('kyc_id_front', options), true);
    assert.equal(isAllowedUploadField('attachment', options), false);
});

test('upload field guard rejects unknown body fields and duplicate files', () => {
    const guard = validateUploadedFileFields({
        allowedFields: ['profile_image'],
        allowedPrefixes: ['kyc_'],
        allowedBodyFields: ['bio'],
        maxFilesPerField: 1
    });

    const unknownBodyRes = createResponse();
    guard({ body: { role: 'admin' }, files: [] }, unknownBodyRes, () => assert.fail('next must not be called'));
    assert.equal(unknownBodyRes.statusCode, 400);

    const duplicateRes = createResponse();
    guard({
        body: { bio: 'ok' },
        files: [
            { fieldname: 'profile_image' },
            { fieldname: 'profile_image' }
        ]
    }, duplicateRes, () => assert.fail('next must not be called'));
    assert.equal(duplicateRes.statusCode, 400);
});
