import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statfs as defaultStatfs } from 'node:fs/promises';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const round = (value) => Math.round(toNumber(value) * 100) / 100;

const readStorage = async (directory, statfs) => {
    try {
        const stats = await statfs(directory);
        const blockSize = toNumber(stats.bsize);
        const totalBytes = blockSize * toNumber(stats.blocks);
        const freeBytes = blockSize * toNumber(stats.bavail);
        return {
            available: true,
            totalBytes,
            freeBytes,
            freePercent: totalBytes > 0 ? round((freeBytes / totalBytes) * 100) : 0,
        };
    } catch (error) {
        return {
            available: false,
            errorCode: typeof error?.code === 'string' ? error.code.slice(0, 40) : 'STORAGE_UNAVAILABLE',
        };
    }
};

const readOutbox = async (pool) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE processed_at IS NULL) AS pending_count,
                COUNT(*) FILTER (
                    WHERE processed_at IS NULL AND last_error_code IS NOT NULL
                ) AS failed_count,
                COALESCE(
                    EXTRACT(EPOCH FROM (
                        CURRENT_TIMESTAMP - MIN(available_at) FILTER (WHERE processed_at IS NULL)
                    )),
                    0
                ) AS oldest_pending_seconds
            FROM payment_outbox
        `);
        const row = result.rows?.[0] || {};
        return {
            pending: toNumber(row.pending_count),
            failed: toNumber(row.failed_count),
            oldestPendingSeconds: round(row.oldest_pending_seconds),
        };
    } catch (error) {
        return {
            pending: 0,
            failed: 0,
            oldestPendingSeconds: 0,
            available: false,
            errorCode: typeof error?.code === 'string' ? error.code.slice(0, 40) : 'OUTBOX_UNAVAILABLE',
        };
    }
};

const defaultDirectories = {
    uploads: path.join(projectRoot, 'uploads'),
    privateUploads: path.join(projectRoot, 'private_uploads'),
};

const defaultThresholds = {
    dbWaiting: 5,
    diskFreePercent: 10,
    outboxLagSeconds: 300,
};

export const collectOperationalSnapshot = async ({
    pool,
    cacheStats = () => ({}),
    statfs = defaultStatfs,
    directories = defaultDirectories,
    thresholds = defaultThresholds,
} = {}) => {
    if (!pool?.query) throw new TypeError('A PostgreSQL-compatible pool is required');

    let databaseStatus = 'connected';
    try {
        await pool.query('SELECT 1');
    } catch {
        databaseStatus = 'disconnected';
    }

    const [uploads, privateUploads, outbox] = await Promise.all([
        readStorage(directories.uploads, statfs),
        readStorage(directories.privateUploads, statfs),
        readOutbox(pool),
    ]);
    const cache = cacheStats() || {};
    const effectiveThresholds = { ...defaultThresholds, ...thresholds };
    const database = {
        status: databaseStatus,
        total: toNumber(pool.totalCount),
        idle: toNumber(pool.idleCount),
        waiting: toNumber(pool.waitingCount),
    };
    const signals = [];

    if (database.status !== 'connected') {
        signals.push({ code: 'DATABASE_UNAVAILABLE', severity: 'critical' });
    }
    if (database.waiting > effectiveThresholds.dbWaiting) {
        signals.push({
            code: 'DB_POOL_WAITING',
            severity: 'warning',
            value: database.waiting,
            threshold: effectiveThresholds.dbWaiting,
        });
    }

    const storageEntries = Object.entries({ uploads, privateUploads });
    const unavailableStorage = storageEntries
        .filter(([, value]) => !value.available)
        .map(([name]) => name);
    if (unavailableStorage.length > 0) {
        signals.push({
            code: 'UPLOAD_STORAGE_UNAVAILABLE',
            severity: 'high',
            stores: unavailableStorage,
        });
    }
    const lowStorage = storageEntries
        .filter(([, value]) => value.available && value.freePercent < effectiveThresholds.diskFreePercent)
        .map(([name]) => name);
    if (lowStorage.length > 0) {
        signals.push({
            code: 'UPLOAD_STORAGE_LOW',
            severity: 'high',
            stores: lowStorage,
            threshold: effectiveThresholds.diskFreePercent,
        });
    }
    if (outbox.available === false) {
        signals.push({ code: 'PAYMENT_OUTBOX_UNAVAILABLE', severity: 'high', errorCode: outbox.errorCode });
    } else {
        if (outbox.failed > 0) {
            signals.push({ code: 'PAYMENT_OUTBOX_ERRORS', severity: 'high', value: outbox.failed });
        }
        if (outbox.oldestPendingSeconds > effectiveThresholds.outboxLagSeconds) {
            signals.push({
                code: 'PAYMENT_OUTBOX_LAG',
                severity: 'warning',
                value: outbox.oldestPendingSeconds,
                threshold: effectiveThresholds.outboxLagSeconds,
            });
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        database,
        storage: { uploads, privateUploads },
        cache,
        outbox,
        signals,
    };
};

export default collectOperationalSnapshot;
