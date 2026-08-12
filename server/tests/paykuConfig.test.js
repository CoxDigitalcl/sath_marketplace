import test from 'node:test';
import assert from 'node:assert/strict';

import { getPaykuRuntimeConfig } from '../services/paykuConfig.js';

const sandboxEnvironment = {
    NODE_ENV: 'production',
    PAYKU_API_URL: 'https://des.payku.cl/api',
    PAYKU_PUBLIC_TOKEN: 'sandbox-token',
};

test('production runtime rejects implicit Payku sandbox credentials', () => {
    assert.throws(
        () => getPaykuRuntimeConfig(sandboxEnvironment),
        /PAYKU_MODE=sandbox/
    );
});

test('production runtime permits explicitly selected Payku sandbox mode', () => {
    const config = getPaykuRuntimeConfig({ ...sandboxEnvironment, PAYKU_MODE: 'sandbox' });

    assert.deepEqual(config, {
        apiUrl: 'https://des.payku.cl/api',
        publicToken: 'sandbox-token',
        mode: 'sandbox',
    });
});

test('explicit sandbox mode rejects demo credentials', () => {
    assert.throws(
        () => getPaykuRuntimeConfig({
            ...sandboxEnvironment,
            PAYKU_MODE: 'sandbox',
            PAYKU_PUBLIC_TOKEN: 'demo',
        }),
        /non-demo credentials/
    );
});

test('explicit production mode rejects the Payku sandbox API', () => {
    assert.throws(
        () => getPaykuRuntimeConfig({ ...sandboxEnvironment, PAYKU_MODE: 'production' }),
        /cannot use sandbox/
    );
});

test('production runtime accepts live Payku configuration without an override', () => {
    const config = getPaykuRuntimeConfig({
        NODE_ENV: 'production',
        PAYKU_API_URL: 'https://app.payku.cl/api',
        PAYKU_PUBLIC_TOKEN: 'production-token',
    });

    assert.equal(config.mode, 'production');
});

test('development keeps the existing demo sandbox fallback', () => {
    const config = getPaykuRuntimeConfig({ NODE_ENV: 'development' });

    assert.equal(config.apiUrl, 'https://des.payku.cl/api');
    assert.equal(config.publicToken, 'demo');
    assert.equal(config.mode, 'sandbox');
});

test('unknown Payku modes fail closed', () => {
    assert.throws(
        () => getPaykuRuntimeConfig({ ...sandboxEnvironment, PAYKU_MODE: 'automatic' }),
        /sandbox or production/
    );
});
