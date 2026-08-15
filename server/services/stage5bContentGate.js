import { TEMPORARY_LEGAL_POLICIES } from '../content/temporaryLegalPolicies.js';

export const STAGE5B_TEST_SERVICES = Object.freeze([
    Object.freeze({
        id: 'f85239ef-ce1d-47c0-adc2-8a20265e5c7e',
        expectedTitle: 'clases de ingles'
    }),
    Object.freeze({
        id: '2c11a2ad-8c80-4f5d-bee9-2660da7ae4f1',
        expectedTitle: 'Mantención de Estufas'
    })
]);

const TEST_SERVICE_IDS = Object.freeze(STAGE5B_TEST_SERVICES.map(({ id }) => id));

const decodeStoredValue = (value) => {
    let decoded = value;

    for (let attempt = 0; attempt < 3 && typeof decoded === 'string'; attempt += 1) {
        try {
            decoded = JSON.parse(decoded);
        } catch {
            break;
        }
    }

    return decoded;
};

const collectPolicyEntries = (value) => {
    const decoded = decodeStoredValue(value);
    if (Array.isArray(decoded)) return decoded.filter((entry) => entry && typeof entry === 'object');
    if (!decoded || typeof decoded !== 'object') return [];

    for (const key of ['legal_policies', 'policies', 'value']) {
        if (key in decoded) {
            const nested = collectPolicyEntries(decoded[key]);
            if (nested.length > 0) return nested;
        }
    }

    return [];
};

export const hasStoredPolicyEntries = (value) => collectPolicyEntries(value).length > 0;

const summarizePolicies = (value) => {
    const policies = collectPolicyEntries(value);
    return {
        count: policies.length,
        active: policies.filter((policy) => policy.isActive === true || policy.is_active === true).length,
        slugs: policies
            .map((policy) => String(policy.slug || '').trim())
            .filter(Boolean)
            .sort()
    };
};

const assertExpectedServices = (rows) => {
    if (rows.length !== TEST_SERVICE_IDS.length) {
        const found = new Set(rows.map(({ id }) => id));
        const missing = TEST_SERVICE_IDS.filter((id) => !found.has(id));
        throw new Error(`Stage 5B stopped: expected test services are missing: ${missing.join(', ')}`);
    }

    const expectedTitleById = new Map(
        STAGE5B_TEST_SERVICES.map(({ id, expectedTitle }) => [id, expectedTitle.toLocaleLowerCase('es-CL')])
    );

    for (const row of rows) {
        const expected = expectedTitleById.get(row.id);
        const actual = String(row.title || '').trim().toLocaleLowerCase('es-CL');
        if (actual !== expected) {
            throw new Error(`Stage 5B stopped: service ${row.id} title no longer matches the reviewed test record.`);
        }
    }
};

export const closeStage5bContentGate = async (client, { apply = false } = {}) => {
    if (!client?.query) throw new Error('A PostgreSQL client is required');

    let transactionOpen = false;

    try {
        await client.query('BEGIN');
        transactionOpen = true;

        const serviceResult = await client.query(`
            SELECT id, title, is_active
            FROM services
            WHERE id = ANY($1::uuid[])
            ORDER BY id
            FOR UPDATE
        `, [TEST_SERVICE_IDS]);

        assertExpectedServices(serviceResult.rows);

        const settingsResult = await client.query(`
            SELECT key, value, group_name
            FROM platform_settings
            WHERE key = 'legal_policies'
            FOR UPDATE
        `);

        const existingSetting = settingsResult.rows[0] || null;
        const preserveExistingPolicies = hasStoredPolicyEntries(existingSetting?.value);
        let policyAction = preserveExistingPolicies ? 'preserve-existing' : 'seed-temporary';

        if (apply) {
            await client.query(`
                UPDATE services
                SET is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY($1::uuid[])
            `, [TEST_SERVICE_IDS]);

            if (preserveExistingPolicies) {
                if (existingSetting.group_name !== 'legal_policies') {
                    await client.query(`
                        UPDATE platform_settings
                        SET group_name = 'legal_policies',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE key = 'legal_policies'
                    `);
                    policyAction = 'preserve-existing-and-repair-group';
                }
            } else {
                await client.query(`
                    INSERT INTO platform_settings(key, value, group_name)
                    VALUES('legal_policies', $1::jsonb, 'legal_policies')
                    ON CONFLICT(key)
                    DO UPDATE SET
                        value = EXCLUDED.value,
                        group_name = EXCLUDED.group_name,
                        updated_at = CURRENT_TIMESTAMP
                `, [JSON.stringify(TEMPORARY_LEGAL_POLICIES)]);
            }
        }

        const verifiedServiceResult = apply
            ? await client.query(`
                SELECT id, title, is_active
                FROM services
                WHERE id = ANY($1::uuid[])
                ORDER BY id
            `, [TEST_SERVICE_IDS])
            : serviceResult;

        const verifiedSettingResult = apply
            ? await client.query(`
                SELECT key, value, group_name
                FROM platform_settings
                WHERE key = 'legal_policies'
            `)
            : settingsResult;

        const verifiedSetting = verifiedSettingResult.rows[0] || null;
        const policyValue = apply
            ? verifiedSetting?.value
            : (preserveExistingPolicies ? existingSetting?.value : TEMPORARY_LEGAL_POLICIES);

        if (apply && verifiedServiceResult.rows.some(({ is_active }) => is_active !== false)) {
            throw new Error('Stage 5B verification failed: a test service remains active.');
        }

        if (apply && (!verifiedSetting || verifiedSetting.group_name !== 'legal_policies')) {
            throw new Error('Stage 5B verification failed: legal policy settings are unavailable.');
        }

        const policySummary = summarizePolicies(policyValue);
        if (policySummary.active < 2) {
            throw new Error('Stage 5B verification failed: two active legal policies are required.');
        }

        if (apply) {
            await client.query('COMMIT');
        } else {
            await client.query('ROLLBACK');
        }
        transactionOpen = false;

        return {
            mode: apply ? 'apply' : 'dry-run',
            services: verifiedServiceResult.rows.map(({ id, title, is_active }) => ({
                id,
                title,
                active: Boolean(is_active)
            })),
            policyAction,
            policies: policySummary
        };
    } catch (error) {
        if (transactionOpen) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // Preserve the original failure.
            }
        }
        throw error;
    }
};
