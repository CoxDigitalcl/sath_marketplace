import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readServerFile = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('booking controller keeps legacy booking operations but replaces both payment handlers', async () => {
    const source = await readServerFile('controllers/bookingController.js');

    assert.match(source, /from '\.\/bookingController\.legacy\.js'/);
    assert.match(source, /handlePaykuWebhook/);
    assert.match(source, /verifyPayment/);
    assert.match(source, /from '\.\/paykuWebhookController\.js'/);
    assert.match(source, /ENABLE_PAYMENT_OUTBOX_WORKER === 'true'/);
});

test('public verification handler is read-only and emits private cache/index headers', async () => {
    const source = await readServerFile('controllers/paykuWebhookController.js');
    const verifySegment = source
        .split('export const verifyPayment =')[1]
        .split('export const startPaymentOutboxWorker =')[0];

    assert.ok(verifySegment);
    assert.doesNotMatch(verifySegment, /verifyTransaction\s*\(/);
    assert.doesNotMatch(verifySegment, /\b(?:UPDATE|INSERT|DELETE)\b/);
    assert.match(verifySegment, /setPrivateResponseHeaders\(res\)/);
    assert.match(source, /Cache-Control', 'no-store'/);
    assert.match(source, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
});

test('Payku verification logs bounded fields instead of the gateway payload', async () => {
    const source = await readServerFile('services/payku.js');

    assert.doesNotMatch(source, /JSON\.stringify\(response\.data\)/);
    assert.match(source, /safeIdentifier/);
    assert.match(source, /errorCode/);
});
