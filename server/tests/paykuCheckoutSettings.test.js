import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';

import { createTransaction, verifyTransaction } from '../services/payku.js';
import { describePaykuCheckout, readPaykuCheckoutSettings, updatePaykuCheckoutMode } from '../services/paykuCheckoutSettings.js';

const actorId = 'fa6e9af9-f935-4b2e-8fb7-1af35503bd8f';
const sandboxUrl = 'https://des.payku.cl/api/transaction';
const productionUrl = 'https://app.payku.cl/api/transaction';
const env = {
    PAYKU_MODE: 'sandbox',
    PAYKU_API_URL: 'https://des.payku.cl/api',
    PAYKU_PUBLIC_TOKEN: 'sandbox-test-token',
    PAYKU_PRODUCTION_PUBLIC_TOKEN: 'production-test-token',
};

const createSettingsPool = () => {
    let settings;
    return {
        async query(sql, params) {
            if (sql.startsWith('SELECT')) return { rows: settings ? [settings] : [] };
            assert.match(sql, /WHERE payku_checkout_settings\.revision = \$3/);
            const [mode, actor, revision] = params;
            assert.equal(actor, actorId);
            if ((settings?.revision ?? 0) !== revision) return { rows: [] };
            settings = { mode, revision: revision + 1 };
            return { rows: [settings] };
        },
    };
};

test('switching changes the gateway for new payments and keeps historical verification on the original gateway', async (t) => {
    const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
    Object.assign(process.env, env);
    t.after(() => {
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    const pool = createSettingsPool();
    const requests = [];
    t.mock.method(axios, 'post', async (url, payload, options) => {
        requests.push([url, options.headers.Authorization]);
        assert.match(payload.urlnotify, /\/api\/bookings\/webhook\/payku$/);
        return { data: { id: 'trx-test', url: 'https://payku.example/checkout' } };
    });
    t.mock.method(axios, 'get', async (url, options) => {
        requests.push([url, options.headers.Authorization]);
        if (url.endsWith('/trx-test')) return { data: { status: 'pending' } };
        if (url === sandboxUrl) {
            return { data: { id: 'trx-test', order: actorId, status: 'register', gateway_response: {} } };
        }
        return { data: { transaction: [] } };
    });

    const start = () => createTransaction(actorId, 6000, 'client@example.invalid', 'Reserva', null, pool);
    assert.equal((await start()).mode, 'sandbox');
    assert.deepEqual(await updatePaykuCheckoutMode({ pool, mode: 'production', revision: 0, actorId }), {
        mode: 'production', revision: 1,
    });
    assert.equal((await start()).mode, 'production');
    await verifyTransaction('trx-test', 'sandbox');
    await verifyTransaction('trx-test'); // An older booking with no stored environment.
    await updatePaykuCheckoutMode({ pool, mode: 'sandbox', revision: 1, actorId });
    await verifyTransaction('trx-test', 'production');
    assert.equal((await start()).mode, 'sandbox');

    assert.deepEqual(requests, [
        [sandboxUrl, 'Bearer sandbox-test-token'],
        [productionUrl, 'Bearer production-test-token'],
        [productionUrl, 'Bearer production-test-token'],
        [sandboxUrl + '/trx-test', 'Bearer sandbox-test-token'],
        [sandboxUrl + '/trx-test', 'Bearer sandbox-test-token'],
        [sandboxUrl, 'Bearer sandbox-test-token'],
        [productionUrl + '/trx-test', 'Bearer production-test-token'],
        [sandboxUrl, 'Bearer sandbox-test-token'],
    ]);
});

test('keeps sandbox active when production credentials are missing or the provider rejects them', async () => {
    const pool = createSettingsPool();
    const switchMode = { pool, env, mode: 'production', revision: 0, actorId };
    const missingCredentials = { ...env, PAYKU_PRODUCTION_PUBLIC_TOKEN: '' };
    await assert.rejects(updatePaykuCheckoutMode({ ...switchMode, env: missingCredentials }), { status: 422 });
    await assert.rejects(updatePaykuCheckoutMode({
        ...switchMode,
        http: { get: async () => { throw new Error('invalid credentials'); } },
    }), { status: 502 });
    await assert.rejects(updatePaykuCheckoutMode({
        ...switchMode,
        http: { get: async () => ({ data: { status: 'failed' } }) },
    }), { status: 502 });
    const settings = await readPaykuCheckoutSettings(pool, missingCredentials);
    assert.deepEqual(settings, { mode: 'sandbox', revision: 0 });
    const state = describePaykuCheckout(settings, missingCredentials);
    assert.deepEqual(state.configured, { sandbox: true, production: false });
    assert.doesNotMatch(JSON.stringify(state), /sandbox-test-token|production-test-token/);
});

test('accepts Payku authenticated no-records responses for an account without transactions', async () => {
    const pool = createSettingsPool();
    const result = await updatePaykuCheckoutMode({
        pool, env, mode: 'production', revision: 0, actorId,
        http: { get: async () => ({ data: {
            status: 'failed',
            message_error: 'there are no records. filter date_init=2026-11-11,date_end=2026-11-11',
        } }) },
    });
    assert.deepEqual(result, { mode: 'production', revision: 1 });
});

test('rejects Payku error envelopes other than the authenticated no-records response', async () => {
    const pool = createSettingsPool();
    await assert.rejects(updatePaykuCheckoutMode({
        pool, env, mode: 'production', revision: 0, actorId,
        http: { get: async () => ({ data: { status: 'failed', message_error: 'waiting token public' } }) },
    }), { status: 502 });
    assert.deepEqual(await readPaykuCheckoutSettings(pool, env), { mode: 'sandbox', revision: 0 });
});

test('rejects a mode change superseded while the provider is being checked', async () => {
    const pool = createSettingsPool();
    const switchMode = { pool, env, mode: 'production', revision: 0, actorId };
    const successfulProbe = { get: async () => ({ data: { transaction: [] } }) };
    await assert.rejects(updatePaykuCheckoutMode({
        ...switchMode,
        http: { get: async () => {
            await updatePaykuCheckoutMode({ ...switchMode, http: successfulProbe });
            return successfulProbe.get();
        } },
    }), { status: 409 });
    assert.deepEqual(await readPaykuCheckoutSettings(pool, env), { mode: 'production', revision: 1 });
});
