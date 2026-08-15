import assert from 'node:assert/strict';
import test from 'node:test';

import {
    TEMPORARY_LEGAL_POLICIES,
    TEMPORARY_NOTICE,
    TEMPORARY_POLICY_REVIEW_DEADLINE
} from '../content/temporaryLegalPolicies.js';
import {
    STAGE5B_TEST_SERVICES,
    closeStage5bContentGate,
    hasStoredPolicyEntries
} from '../services/stage5bContentGate.js';

const createFakeClient = ({ storedPolicies = null, groupName = 'legal_policies' } = {}) => {
    const state = {
        services: STAGE5B_TEST_SERVICES.map(({ id, expectedTitle }) => ({
            id,
            title: expectedTitle,
            is_active: true
        })),
        setting: storedPolicies === null
            ? null
            : { key: 'legal_policies', value: storedPolicies, group_name: groupName },
        queries: []
    };

    return {
        state,
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            state.queries.push({ sql: normalized, params });

            if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
                return { rows: [] };
            }

            if (normalized.startsWith('SELECT id, title, is_active FROM services')) {
                return { rows: state.services.map((service) => ({ ...service })) };
            }

            if (normalized.startsWith('UPDATE services')) {
                const allowed = new Set(params[0]);
                state.services = state.services.map((service) => (
                    allowed.has(service.id) ? { ...service, is_active: false } : service
                ));
                return { rows: [] };
            }

            if (normalized.startsWith('SELECT key, value, group_name FROM platform_settings')) {
                return { rows: state.setting ? [{ ...state.setting }] : [] };
            }

            if (normalized.startsWith('INSERT INTO platform_settings')) {
                state.setting = {
                    key: 'legal_policies',
                    value: JSON.parse(params[0]),
                    group_name: 'legal_policies'
                };
                return { rows: [] };
            }

            if (normalized.startsWith('UPDATE platform_settings')) {
                state.setting = { ...state.setting, group_name: 'legal_policies' };
                return { rows: [] };
            }

            throw new Error(`Unexpected query: ${normalized}`);
        }
    };
};

test('temporary legal policies are active, explicit, and owner-reviewable', () => {
    assert.equal(TEMPORARY_LEGAL_POLICIES.length, 2);
    assert.deepEqual(
        TEMPORARY_LEGAL_POLICIES.map(({ slug }) => slug).sort(),
        ['politica-de-privacidad', 'terminos-y-condiciones-de-uso']
    );
    assert.equal(TEMPORARY_POLICY_REVIEW_DEADLINE, '2026-11-15');
    assert.match(TEMPORARY_NOTICE, /DOCUMENTO TEMPORAL/);

    for (const policy of TEMPORARY_LEGAL_POLICIES) {
        assert.equal(policy.isActive, true);
        assert.equal(policy.isRequired, true);
        assert.equal(policy.isTemporary, true);
        assert.equal(policy.reviewDeadline, TEMPORARY_POLICY_REVIEW_DEADLINE);
        assert.match(policy.content, /soporte@serviciosatuhogar\.cl/);
        assert.match(policy.content, /dueño/i);
        assert.doesNotMatch(policy.content, /<script/i);
    }

    const terms = TEMPORARY_LEGAL_POLICIES.find(({ slug }) => slug === 'terminos-y-condiciones-de-uso');
    const privacy = TEMPORARY_LEGAL_POLICIES.find(({ slug }) => slug === 'politica-de-privacidad');
    assert.match(terms.content, /Ley N° 19\.496/);
    assert.match(terms.content, /Decreto N° 6/);
    assert.match(privacy.content, /Ley N° 19\.628/);
    assert.match(privacy.content, /Ley N° 21\.719/);
    assert.match(privacy.content, /1 de diciembre de 2026/);
});

test('stored policy detection accepts JSONB values and legacy encoded values', () => {
    assert.equal(hasStoredPolicyEntries(TEMPORARY_LEGAL_POLICIES), true);
    assert.equal(hasStoredPolicyEntries(JSON.stringify(TEMPORARY_LEGAL_POLICIES)), true);
    assert.equal(hasStoredPolicyEntries(JSON.stringify(JSON.stringify(TEMPORARY_LEGAL_POLICIES))), true);
    assert.equal(hasStoredPolicyEntries({ legal_policies: TEMPORARY_LEGAL_POLICIES }), true);
    assert.equal(hasStoredPolicyEntries([]), false);
    assert.equal(hasStoredPolicyEntries('{}'), false);
    assert.equal(hasStoredPolicyEntries(null), false);
});

test('apply deactivates only the reviewed service IDs and seeds empty policy settings', async () => {
    const client = createFakeClient();
    const result = await closeStage5bContentGate(client, { apply: true });

    assert.equal(result.mode, 'apply');
    assert.equal(result.policyAction, 'seed-temporary');
    assert.equal(result.policies.active, 2);
    assert.deepEqual(result.services.map(({ id }) => id).sort(), STAGE5B_TEST_SERVICES.map(({ id }) => id).sort());
    assert.ok(result.services.every(({ active }) => active === false));
    assert.ok(client.state.services.every(({ is_active }) => is_active === false));
    assert.equal(client.state.setting.group_name, 'legal_policies');
    assert.equal(client.state.setting.value.length, 2);

    const update = client.state.queries.find(({ sql }) => sql.startsWith('UPDATE services'));
    assert.deepEqual(update.params[0], STAGE5B_TEST_SERVICES.map(({ id }) => id));
    assert.ok(client.state.queries.every(({ sql }) => !sql.startsWith('DELETE')));
    assert.equal(client.state.queries.at(-1).sql, 'COMMIT');
});

test('apply preserves populated owner policies and only repairs their group when needed', async () => {
    const ownerPolicies = TEMPORARY_LEGAL_POLICIES.map((policy, index) => ({
        ...policy,
        id: `owner-${index + 1}`,
        version: 'owner-reviewed'
    }));
    const client = createFakeClient({ storedPolicies: ownerPolicies, groupName: 'general' });
    const result = await closeStage5bContentGate(client, { apply: true });

    assert.equal(result.policyAction, 'preserve-existing-and-repair-group');
    assert.deepEqual(client.state.setting.value, ownerPolicies);
    assert.equal(client.state.setting.group_name, 'legal_policies');
    assert.ok(client.state.queries.some(({ sql }) => sql.startsWith('UPDATE platform_settings')));
    assert.ok(client.state.queries.every(({ sql }) => !sql.startsWith('INSERT INTO platform_settings')));
});

test('dry run rolls back and leaves services and settings unchanged', async () => {
    const client = createFakeClient();
    const result = await closeStage5bContentGate(client);

    assert.equal(result.mode, 'dry-run');
    assert.ok(result.services.every(({ active }) => active === true));
    assert.ok(client.state.services.every(({ is_active }) => is_active === true));
    assert.equal(client.state.setting, null);
    assert.equal(client.state.queries.at(-1).sql, 'ROLLBACK');
    assert.ok(client.state.queries.every(({ sql }) => !sql.startsWith('UPDATE') && !sql.startsWith('INSERT')));
});
