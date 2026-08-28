import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
    new URL('../scripts/migrations/add_service_revisions.sql', import.meta.url),
    'utf8'
);
const schema = fs.readFileSync(new URL('../scripts/schema.sql', import.meta.url), 'utf8');

test('revision migration is expansive, idempotent and preserves one current review per Service', () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS pricing_version BIGINT/i);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS service_revisions/i);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS service_revision_decisions/i);
    assert.match(
        migration,
        /CREATE UNIQUE INDEX IF NOT EXISTS idx_service_revisions_one_current[\s\S]*WHERE status IN \('pending', 'correction_requested'\)/i
    );
    assert.match(migration, /ON CONFLICT \(service_id, revision_number\) DO NOTHING/i);
    assert.doesNotMatch(migration, /\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i);
});

test('revision schema constrains explicit states, immutable snapshots and decision audit linkage', () => {
    for (const state of [
        'applied',
        'pending',
        'approved',
        'correction_requested',
        'rejected',
        'superseded',
    ]) {
        assert.match(schema, new RegExp(`'${state}'`));
    }
    assert.match(schema, /before_snapshot JSONB NOT NULL/i);
    assert.match(schema, /proposed_snapshot JSONB NOT NULL/i);
    assert.match(schema, /FOREIGN KEY \(revision_id, service_id\)[\s\S]*REFERENCES service_revisions\(id, service_id\)/i);
    assert.match(schema, /pricing_version BIGINT NOT NULL DEFAULT 1/i);
});

test('migration backfills one safe baseline without moderation metadata', () => {
    assert.match(migration, /'baseline'[\s\S]*'applied'[\s\S]*'none'/i);
    assert.match(migration, /WHERE NOT EXISTS \([\s\S]*existing\.service_id = s\.id/i);
    for (const excluded of ['moderation_reason', 'moderated_at', 'moderated_by']) {
        assert.match(migration, new RegExp(`'${excluded}'`));
    }
});

test('legacy pending Services receive a full update review that cannot autoactivate them', () => {
    assert.match(
        migration,
        /Legacy pending rows[\s\S]*2,[\s\S]*'update',[\s\S]*'pending',[\s\S]*'full'/i
    );
    assert.match(migration, /WHERE s\.moderation_status = 'pending'/i);
    assert.match(migration, /'LEGACY_PENDING_REVIEW'/i);
    assert.doesNotMatch(
        migration,
        /UPDATE\s+services[\s\S]*SET[\s\S]*is_active\s*=\s*(?:TRUE|'true')/i
    );
});
