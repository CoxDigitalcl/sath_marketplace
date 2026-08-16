import logger from '../config/logger.js';
import AlertService, { SEVERITY } from './alertService.js';
import { collectOperationalSnapshot } from './operationalSnapshotService.js';

const positiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const severityMap = {
    critical: SEVERITY.CRITICAL,
    high: SEVERITY.HIGH,
    warning: SEVERITY.WARNING,
};

export const runOperationalCheck = async ({ pool, cacheStats, alerts = AlertService, collect = collectOperationalSnapshot } = {}) => {
    const snapshot = await collect({
        pool,
        cacheStats,
        thresholds: {
            dbWaiting: positiveInteger(process.env.OBS_DB_WAITING_THRESHOLD, 5),
            diskFreePercent: positiveInteger(process.env.OBS_DISK_FREE_PERCENT_THRESHOLD, 10),
            outboxLagSeconds: positiveInteger(process.env.OBS_OUTBOX_LAG_SECONDS_THRESHOLD, 300),
        },
    });

    logger.info('Operational snapshot collected.', {
        event: 'operational_snapshot',
        databaseStatus: snapshot.database.status,
        dbWaiting: snapshot.database.waiting,
        cacheKeys: snapshot.cache.keys || 0,
        outboxPending: snapshot.outbox.pending,
        outboxFailed: snapshot.outbox.failed,
        signalCodes: snapshot.signals.map(({ code }) => code),
    });

    await Promise.all(snapshot.signals.map((signal) => alerts.notify(
        new Error(`Operational threshold reached: ${signal.code}`),
        {
            alertKey: signal.code,
            component: 'OPERATIONS',
            event: signal.code,
            value: signal.value,
            threshold: signal.threshold,
            stores: signal.stores,
            errorCode: signal.errorCode,
        },
        severityMap[signal.severity] || SEVERITY.WARNING
    )));

    return snapshot;
};

export const startOperationalMonitor = ({ pool, cacheStats, intervalMs } = {}) => {
    const safeIntervalMs = positiveInteger(intervalMs || process.env.OBSERVABILITY_INTERVAL_MS, 60_000);
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await runOperationalCheck({ pool, cacheStats });
        } catch (error) {
            logger.error('Operational monitor failed.', {
                event: 'operational_monitor_failed',
                errorCode: error?.code || 'OPERATIONAL_MONITOR_FAILED',
            });
        } finally {
            running = false;
        }
    };

    const timer = setInterval(tick, Math.max(30_000, safeIntervalMs));
    timer.unref?.();
    void tick();
    return () => clearInterval(timer);
};

export default startOperationalMonitor;
