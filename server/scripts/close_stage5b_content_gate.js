import { pool } from '../config/db.js';
import { closeStage5bContentGate } from '../services/stage5bContentGate.js';

const apply = process.argv.includes('--apply');
let client;

try {
    client = await pool.connect();
    const result = await closeStage5bContentGate(client, { apply });
    console.log(JSON.stringify(result, null, 2));

    if (!apply) {
        console.log('Dry run only. Re-run with --apply after reviewing the exact service IDs and policy action.');
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    client?.release();
    await pool.end();
}
