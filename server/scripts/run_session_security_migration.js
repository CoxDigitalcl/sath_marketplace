import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(here, 'migrations', 'add_session_security.sql');

try {
    const sql = await fs.readFile(migrationPath, 'utf8');
    await pool.query(sql);
    console.log(JSON.stringify({ status: 'ok', migration: 'add_session_security' }));
} catch {
    console.error('Session security migration failed.');
    process.exitCode = 1;
} finally {
    await pool.end();
}
