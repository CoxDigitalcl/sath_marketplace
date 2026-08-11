// Standalone smoke test for provider uploads.
// Run with: SMOKE_TEST_API_URL=https://example.test/api node server/scripts/test-upload.js

import { randomBytes } from 'node:crypto';

const BASE_URL = (process.env.SMOKE_TEST_API_URL || '').trim().replace(/\/+$/, '');

if (!BASE_URL) {
    console.error('SMOKE_TEST_API_URL is required. Example: https://example.test/api');
    process.exit(2);
}

const appOrigin = new URL(BASE_URL).origin;
const testPassword = process.env.SMOKE_TEST_PASSWORD
    || `Smoke-${randomBytes(18).toString('base64url')}Aa1!`;
const providerUser = {
    email: `provider_${Date.now()}@test.com`,
    password: testPassword,
    role: 'provider'
};

async function testUpload() {
    console.log('--- Starting Upload Verification ---');
    console.log(`Target: ${BASE_URL}`);

    try {
        console.log(`\n1. Registering Provider (${providerUser.email})...`);
        const registrationResponse = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(providerUser)
        });
        const registrationData = await registrationResponse.json();

        if (!registrationResponse.ok) {
            throw new Error(`Registration Failed: ${registrationData.message}`);
        }

        const token = registrationData.token;
        console.log(`Provider registered (ID: ${registrationData.user.id}).`);

        console.log('\n2. Uploading KYC Document...');
        const formData = new FormData();
        formData.append('full_name', 'Test Provider Name');
        formData.append('bio', 'Test provider used for upload verification.');

        const fakePdfContent = '%PDF-1.4 ... Fake PDF Content ...';
        const fileBlob = new Blob([fakePdfContent], { type: 'application/pdf' });
        formData.append('kyc_document_1', fileBlob, 'test-kyc.pdf');

        const uploadResponse = await fetch(`${BASE_URL}/provider/profile`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok) {
            throw new Error(`Upload Failed: ${JSON.stringify(uploadData)}`);
        }

        console.log('Upload successful.');

        const documentPath = uploadData.profile.kyc_documents?.document_1;
        if (documentPath) {
            const fileUrl = new URL(documentPath, appOrigin).toString();
            console.log('\n3. Verifying KYC document is not publicly accessible...');
            const unauthenticatedResponse = await fetch(fileUrl, { redirect: 'manual' });

            if (unauthenticatedResponse.ok) {
                throw new Error('KYC document is unexpectedly accessible without authentication.');
            }

            console.log(`Unauthenticated access blocked (${unauthenticatedResponse.status}).`);
        }
    } catch (error) {
        console.error('\nVerification failed.');
        console.error(error.message);
        process.exit(1);
    }

    console.log('\n--- Upload Verification Completed ---');
}

testUpload();
