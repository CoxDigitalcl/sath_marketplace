import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidUuid } from '../utils/identifiers.js';

test('public UUID validation accepts canonical UUIDs and rejects database error probes', () => {
    assert.equal(isValidUuid('0d4ae10c-2900-4507-8fa9-fa469cee5dce'), true);
    assert.equal(isValidUuid('not-a-uuid'), false);
    assert.equal(isValidUuid("' OR 1=1 --"), false);
    assert.equal(isValidUuid(undefined), false);
});
