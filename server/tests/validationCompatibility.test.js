import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import {
    registerSchema, loginSchema, resetPasswordSchema, adminStepUpSchema, validate,
} from '../utils/validation.js';
import { createServiceRevisionSchema } from '../utils/serviceRevisionValidation.js';

test('registration accepts client and provider but cannot assign an administrative role', () => {
    const body = { email: 'person@example.test', password: 'StrongPassword123' };
    for (const role of ['client', 'provider']) {
        assert.equal(registerSchema.safeParse({ ...body, role }).success, true);
    }
    const result = registerSchema.safeParse({ ...body, role: 'admin' });
    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, 'Role must be either client or provider');
});

test('invalid authentication input still returns a field-level 400 response instead of throwing', () => {
    let response;
    let nextCalled = false;
    const res = {
        status(code) { assert.equal(code, 400); return this; },
        json(body) { response = body; return this; },
    };
    validate(loginSchema)({ body: { email: 'invalid', password: '' } }, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(response.status, 'error');
    assert.deepEqual(response.errors.map(error => error.field), ['email', 'password']);
    assert.ok(response.errors.every(error => typeof error.message === 'string'));
});

test('valid authentication proceeds and password reset and step-up restrictions remain enforced', () => {
    let nextCalled = false;
    validate(loginSchema)({ body: { email: 'person@example.test', password: 'StrongPassword123' } }, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(resetPasswordSchema.safeParse({ resetToken: 'fixture', newPassword: 'weak' }).success, false);
    assert.equal(adminStepUpSchema.safeParse({ password: 'x'.repeat(257) }).success, false);
});

test('service calendar records preserve unknown values but reject oversized configuration and collections', () => {
    const body = { title: 'Servicio', category: 'hogar', price: 1000 };
    const calendar = { schedule: [{ day: 'Lunes', active: true, timeRanges: [] }], custom: { value: 1 } };
    assert.deepEqual(createServiceRevisionSchema.parse({ ...body, calendar_config: calendar }).calendar_config, calendar);
    assert.equal(createServiceRevisionSchema.safeParse({ ...body, calendar_config: { text: 'x'.repeat(100_001) } }).success, false);
    assert.equal(createServiceRevisionSchema.safeParse({ ...body, categories_json: Array.from({ length: 21 }, () => ({ categoryId: 'hogar', subcategory: 'Limpieza' })) }).success, false);
});

test('the current Nodemailer API composes the notification payload without sending external email', async () => {
    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    try {
        const result = await transporter.sendMail({
            from: '"Serviciosatuhogar" <no-reply@example.test>', to: 'person@example.test',
            subject: 'Revisión de servicio', html: '<p>Cambios aprobados.</p>',
        });
        assert.equal(result.envelope.from, 'no-reply@example.test');
        assert.deepEqual(result.envelope.to, ['person@example.test']);
        assert.match(result.message.toString('utf8'), /Cambios aprobados\./u);
    } finally {
        transporter.close();
    }
});
