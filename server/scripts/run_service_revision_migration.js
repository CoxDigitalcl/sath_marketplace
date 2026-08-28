import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from '../config/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(here, 'migrations', 'add_service_revisions.sql');

try {
    const sql = await fs.readFile(migrationPath, 'utf8');
    await pool.query(sql);
    console.log(JSON.stringify({ status: 'ok', migration: 'add_service_revisions' }));
} catch {
    console.error('Service revision migration failed.');
    process.exitCode = 1;
} finally {
    await pool.end();
}
