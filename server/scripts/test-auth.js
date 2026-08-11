// Standalone smoke test for the Auth API.
// Run with: SMOKE_TEST_API_URL=https://example.test/api node server/scripts/test-auth.js

import { randomBytes } from 'node:crypto';

const API_ROOT = (process.env.SMOKE_TEST_API_URL || '').trim().replace(/\/+$/, '');

if (!API_ROOT) {
    console.error('SMOKE_TEST_API_URL is required. Example: https://example.test/api');
    process.exit(2);
}

const BASE_URL = `${API_ROOT}/auth`;
const testPassword = process.env.SMOKE_TEST_PASSWORD
    || `Smoke-${randomBytes(18).toString('base64url')}Aa1!`;
const testUser = {
    email: `test_user_${Date.now()}@example.com`,
    password: testPassword,
    role: 'client'
};

async function testAuth() {
    console.log('--- Starting Auth API Verification ---');
    console.log(`Target: ${BASE_URL}`);
    console.log(`Test User: ${testUser.email}`);

    try {
        console.log('\n1. Testing Registration...');
        const regRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        const regData = await regRes.json();

        if (!regRes.ok) {
            throw new Error(`Registration Failed: ${regData.message}`);
        }

        console.log('Registration successful.');
        console.log(`Token received: ${Boolean(regData.token)}`);
        console.log(`User ID: ${regData.user.id}`);

        console.log('\n2. Testing Login...');
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });

        const loginData = await loginRes.json();

        if (!loginRes.ok) {
            throw new Error(`Login Failed: ${loginData.message}`);
        }

        console.log('Login successful.');
        console.log(`Token received: ${Boolean(loginData.token)}`);
        console.log(`User role: ${loginData.user.role}`);

        console.log('\n3. Testing Duplicate Email...');
        const dupRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        if (dupRes.status === 409) {
            console.log('Duplicate prevention works (409 Conflict).');
        } else {
            console.warn(`Expected 409 for duplicate registration, got ${dupRes.status}.`);
        }
    } catch (error) {
        console.error('\nVerification failed.');
        console.error(error.message);
        process.exit(1);
    }

    console.log('\n--- Auth Verification Completed ---');
}

testAuth();
