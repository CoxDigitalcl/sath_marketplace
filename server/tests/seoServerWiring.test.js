import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverIndex = fs.readFileSync(path.join(testDirectory, '..', 'index.js'), 'utf8');

test('production server mounts the SEO frontend router as its only frontend handler', () => {
    assert.match(
        serverIndex,
        /import createSeoFrontendRouter from '\.\/middleware\/seoFrontend\.js'/
    );
    assert.match(
        serverIndex,
        /app\.use\(createSeoFrontendRouter\(\{ buildPath, db \}\)\)/
    );
    assert.doesNotMatch(serverIndex, /app\.get\('\/provider\/:id'/);
    assert.doesNotMatch(serverIndex, /app\.get\(\/\.\*\//);
    assert.doesNotMatch(serverIndex, /SSR Lite for Provider Profiles/);
});
