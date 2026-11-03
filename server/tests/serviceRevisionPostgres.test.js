import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import pg from 'pg';
import { createServiceRevisionService, FULL_REVIEW_CHECKLIST_ITEMS } from '../services/serviceRevisionService.js';

// Explicit opt-in: use a disposable local database, never the application's DB_* settings.
const databaseUrl = process.env.SERVICE_REVISION_TEST_DATABASE_URL;

test('service revision transitions execute against PostgreSQL', { skip: !databaseUrl }, async (t) => {
    const schemaName = `revision_test_${randomUUID().replaceAll('-', '')}`;
    const setup = new pg.Client({ connectionString: databaseUrl });
    await setup.connect();
    const pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}`, max: 3 });
    t.after(async () => {
        await pool.end();
        await setup.query(`DROP SCHEMA "${schemaName}" CASCADE`);
        await setup.end();
    });
    await setup.query(`CREATE SCHEMA "${schemaName}"`);
    await setup.query(`SET search_path TO "${schemaName}"`);
    await setup.query('CREATE TABLE users (id UUID PRIMARY KEY)');
    const schema = fs.readFileSync(new URL('../scripts/schema.sql', import.meta.url), 'utf8');
    await setup.query(schema.match(/CREATE TABLE IF NOT EXISTS services \([\s\S]*?\n\);/u)[0]);
    await setup.query(fs.readFileSync(new URL('../scripts/migrations/add_service_revisions.sql', import.meta.url), 'utf8'));
    const providerId = randomUUID();
    const adminId = randomUUID();
    await pool.query('INSERT INTO users (id) VALUES ($1), ($2)', [providerId, adminId]);
    const revisions = createServiceRevisionService({ pool });
    const create = () => revisions.createServiceWithInitialRevision({ providerId, proposedChanges: {
        title: 'Instalación de ventilación pasiva', category: 'hogar', price: 15000,
        categories_json: [{ categoryId: 'hogar', subcategory: 'Instalación ventilación pasiva muros' }],
        cover_image_url: 'https://media.example/ventilacion.webp',
    } });
    const decide = (revision, extra = {}) => revisions.decideRevision({
        revisionId: revision.id, expectedRevisionId: revision.id, adminId,
        decision: 'approved', checklistItems: FULL_REVIEW_CHECKLIST_ITEMS, ...extra,
    });

    await t.test('approves a full creation and commits publication, snapshot and audit together', async () => {
        const created = await create();
        assert.equal(created.service.isActive, false);
        const approved = await decide(created.revision);
        assert.equal(approved.service.isActive, true);
        assert.equal(approved.service.moderationStatus, 'approved');
        assert.equal(approved.revision.status, 'approved');
        assert.ok(approved.revision.appliedAt);
        const { rows: [audit] } = await pool.query('SELECT * FROM service_revision_decisions WHERE revision_id = $1', [created.revision.id]);
        assert.deepEqual(audit.checklist_items, FULL_REVIEW_CHECKLIST_ITEMS);
        assert.deepEqual(audit.reviewed_fields, created.revision.pendingFields);
        assert.equal(audit.decided_by, adminId);
        const { rows: [service] } = await pool.query('SELECT * FROM services WHERE id = $1', [created.service.id]);
        assert.deepEqual(service.categories_json, created.revision.proposedSnapshot.categories_json);
        assert.equal(service.moderated_by, adminId);
    });

    await t.test('auto-applies a price and records its applied revision without SQL type ambiguity', async () => {
        const created = await create();
        await decide(created.revision);
        const updated = await revisions.recordServiceChanges({ serviceId: created.service.id, providerId,
            expectedRevisionId: null, proposedChanges: { price: 22000 } });
        assert.equal(updated.outcome, 'applied');
        assert.equal(updated.revision.status, 'applied');
        assert.ok(updated.revision.appliedAt);
        assert.equal(updated.service.pricingVersion, 2);
    });

    await t.test('approves a targeted edit without reactivating a paused service', async () => {
        const created = await create();
        await decide(created.revision);
        await pool.query('UPDATE services SET is_active = FALSE WHERE id = $1', [created.service.id]);
        const updated = await revisions.recordServiceChanges({ serviceId: created.service.id, providerId,
            expectedRevisionId: null, proposedChanges: { cover_image_url: 'https://media.example/nueva.webp' } });
        const approved = await decide(updated.revision, { checklistItems: [] });
        assert.equal(approved.service.isActive, false);
        assert.equal(approved.revision.status, 'approved');
        const { rows: [service] } = await pool.query('SELECT cover_image_url FROM services WHERE id = $1', [created.service.id]);
        assert.equal(service.cover_image_url, 'https://media.example/nueva.webp');
    });

    for (const decision of ['correction_requested', 'rejected']) {
        await t.test(`records ${decision} and refuses a second decision`, async () => {
            const created = await create();
            const result = await decide(created.revision, { decision, reasonCode: 'INCOMPLETE_INFORMATION', comment: 'Completa la información del servicio.' });
            assert.equal(result.revision.status, decision);
            assert.equal(result.service.isActive, false);
            await assert.rejects(decide(created.revision), { code: 'SERVICE_REVISION_STALE' });
            const { rows: [audit] } = await pool.query('SELECT COUNT(*)::int AS count FROM service_revision_decisions WHERE revision_id = $1', [created.revision.id]);
            assert.equal(audit.count, 1);
        });
    }

    await t.test('an incomplete checklist cannot publish or leave an audit entry', async () => {
        const created = await create();
        await assert.rejects(decide(created.revision, { checklistItems: ['information_verified'] }), { code: 'FULL_REVIEW_CHECKLIST_REQUIRED' });
        const { rows: [state] } = await pool.query(`SELECT s.is_active, sr.status,
            (SELECT COUNT(*)::int FROM service_revision_decisions WHERE revision_id = sr.id) AS decisions
            FROM services s JOIN service_revisions sr ON sr.service_id = s.id WHERE sr.id = $1`, [created.revision.id]);
        assert.equal(state.is_active, false);
        assert.equal(state.status, 'pending');
        assert.equal(state.decisions, 0);
    });

    await t.test('concurrent approvals commit exactly one decision', async () => {
        const created = await create();
        const results = await Promise.allSettled([decide(created.revision), decide(created.revision)]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.find(result => result.status === 'rejected').reason.code, 'SERVICE_REVISION_STALE');
    });

    await t.test('an audit failure rolls publication back and the same review can be retried', async () => {
        const created = await create();
        await pool.query(`CREATE FUNCTION fail_decision_audit() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'Injected decision audit failure'; END; $$`);
        await pool.query(`CREATE TRIGGER fail_decision_audit BEFORE INSERT ON service_revision_decisions
            FOR EACH ROW EXECUTE FUNCTION fail_decision_audit()`);
        try {
            await assert.rejects(decide(created.revision), /Injected decision audit failure/u);
            const { rows: [state] } = await pool.query(`SELECT s.is_active, s.moderation_status, sr.status,
                (SELECT COUNT(*)::int FROM service_revision_decisions WHERE revision_id = sr.id) AS decisions
                FROM services s JOIN service_revisions sr ON sr.service_id = s.id WHERE sr.id = $1`, [created.revision.id]);
            assert.equal(state.is_active, false);
            assert.equal(state.moderation_status, 'pending');
            assert.equal(state.status, 'pending');
            assert.equal(state.decisions, 0);
        } finally {
            await pool.query('DROP TRIGGER fail_decision_audit ON service_revision_decisions');
        }
        assert.equal((await decide(created.revision)).revision.status, 'approved');
    });
});
