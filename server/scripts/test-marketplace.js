// Standalone smoke test for marketplace flows.
// Run with: SMOKE_TEST_API_URL=https://example.test/api node server/scripts/test-marketplace.js

import { randomBytes } from 'node:crypto';

const BASE_URL = (process.env.SMOKE_TEST_API_URL || '').trim().replace(/\/+$/, '');

if (!BASE_URL) {
    console.error('SMOKE_TEST_API_URL is required. Example: https://example.test/api');
    process.exit(2);
}

const testPassword = process.env.SMOKE_TEST_PASSWORD
    || `Smoke-${randomBytes(18).toString('base64url')}Aa1!`;
const providerUser = {
    email: `prov_${Date.now()}@test.com`,
    password: testPassword,
    role: 'provider'
};
const clientUser = {
    email: `client_${Date.now()}@test.com`,
    password: testPassword,
    role: 'client'
};

async function testMarketplace() {
    console.log('--- Starting Marketplace Logic Verification ---');
    console.log(`Target: ${BASE_URL}`);

    try {
        console.log('\n1. Registering Users...');

        const providerRegistration = await register(providerUser);
        const providerToken = providerRegistration.token;
        const providerId = providerRegistration.user.id;
        console.log(`Provider registered (ID: ${providerId}).`);

        const clientRegistration = await register(clientUser);
        const clientToken = clientRegistration.token;
        const clientId = clientRegistration.user.id;
        console.log(`Client registered (ID: ${clientId}).`);

        console.log('\n2. Creating Service...');
        const serviceData = {
            title: 'Emergency Plumbing - Video Diagnostic',
            description: 'I will diagnose your leak via video call.',
            category: 'Plumbing',
            price: 15000,
            video_url: 'https://youtube.com/demo'
        };

        const serviceResponse = await fetch(`${BASE_URL}/services`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${providerToken}`
            },
            body: JSON.stringify(serviceData)
        });
        const serviceJson = await serviceResponse.json();
        if (!serviceResponse.ok) {
            throw new Error(`Service Create Failed: ${serviceJson.message}`);
        }

        const serviceId = serviceJson.service.id;
        console.log(`Service created: ${serviceJson.service.title} (ID: ${serviceId}).`);

        console.log('\n3. Testing Self-Booking Prevention...');
        const selfBookingResponse = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${providerToken}`
            },
            body: JSON.stringify({ service_id: serviceId, scheduled_date: new Date().toISOString() })
        });

        if (selfBookingResponse.status === 403) {
            console.log('Self-booking blocked (403 Forbidden).');
        } else {
            console.warn(`Self-booking should return 403, got ${selfBookingResponse.status}.`);
        }

        console.log('\n4. Client Booking Service...');
        const bookingResponse = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${clientToken}`
            },
            body: JSON.stringify({ service_id: serviceId, scheduled_date: new Date().toISOString() })
        });
        const bookingJson = await bookingResponse.json();

        if (!bookingResponse.ok) {
            throw new Error(`Booking Failed: ${bookingJson.message}`);
        }

        console.log(`Booking created (ID: ${bookingJson.booking.id}).`);

        const status = bookingJson.booking.status;
        if (status === 'pending_payment') {
            console.log(`Status verified: '${status}'.`);
        } else {
            throw new Error(`Expected 'pending_payment', got '${status}'.`);
        }

        console.log('\n5. Verifying Provider Booking List...');
        const listResponse = await fetch(`${BASE_URL}/bookings`, {
            headers: { Authorization: `Bearer ${providerToken}` }
        });
        const listJson = await listResponse.json();

        if (listJson.bookings && listJson.bookings.length > 0) {
            console.log(`Provider has ${listJson.bookings.length} booking(s).`);
        } else {
            console.warn('Provider sees no bookings.');
        }
    } catch (error) {
        console.error('\nVerification failed.');
        console.error(error.message);
        process.exit(1);
    }

    console.log('\n--- Marketplace Verification Completed ---');
}

async function register(user) {
    const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    const json = await response.json();
    if (!response.ok) {
        throw new Error(json.message);
    }
    return json;
}

testMarketplace();
