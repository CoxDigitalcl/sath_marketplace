import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

test('route modules expose no HTTP migration, repair or trace handlers', async () => {
    const routesDirectory = path.join(serverRoot, 'routes');
    const routeFiles = (await fs.readdir(routesDirectory)).filter(name => name.endsWith('.js'));
    const sources = await Promise.all(routeFiles.map(name => fs.readFile(path.join(routesDirectory, name), 'utf8')));
    const allRoutes = sources.join('\n');

    assert.doesNotMatch(allRoutes, /ENABLE_MAINTENANCE_ROUTES/);
    assert.doesNotMatch(
        allRoutes,
        /router\.(?:get|post|put|patch|delete)\(['"]\/(?:migration|migrations|db-migrate|debug|fix-|trace-notifications)/
    );
});
