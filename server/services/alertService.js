import axios from 'axios';
import logger from '../config/logger.js';
import { sendEmail } from './notificationService.js';

export const SEVERITY = Object.freeze({
    CRITICAL: 'critical',
    HIGH: 'high',
    WARNING: 'warning',
    INFO: 'info',
});

const SENSITIVE_KEY = /password|secret|token|authorization|cookie|email|rut|phone|payload|body|ip|address/i;

const redactString = (value) => String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]')
    .replace(/(bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/([?&](?:token|secret|code|key)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 500);

const sanitizeValue = (value, depth = 0) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (depth >= 2) return '[truncated]';
    if (Array.isArray(value)) return value.slice(0, 10).map((entry) => sanitizeValue(entry, depth + 1));
    if (typeof value !== 'object') return redactString(value);

    return Object.fromEntries(
        Object.entries(value)
            .slice(0, 30)
            .filter(([key]) => !SENSITIVE_KEY.test(key))
            .map(([key, entry]) => [key.slice(0, 60), sanitizeValue(entry, depth + 1)])
    );
};

export const sanitizeAlertContext = (context = {}) => sanitizeValue(context) || {};

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const positiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const createAlertService = ({
    webhookUrl = process.env.DISCORD_WEBHOOK_URL || '',
    environment = process.env.NODE_ENV || 'development',
    adminEmail = process.env.ADMIN_EMAIL || '',
    dedupWindowMs = positiveInteger(process.env.ALERT_DEDUP_WINDOW_MS, 5 * 60 * 1000),
    now = () => Date.now(),
    httpClient = axios,
    sendEmailFn = sendEmail,
    log = logger,
} = {}) => {
    const recentAlerts = new Map();
    const counters = { received: 0, deduplicated: 0, webhook: 0, email: 0, deliveryFailures: 0 };

    const notify = async (error, context = {}, severity = SEVERITY.CRITICAL) => {
        counters.received += 1;
        const safeSeverity = Object.values(SEVERITY).includes(severity) ? severity : SEVERITY.HIGH;
        const safeContext = sanitizeAlertContext(context);
        const safeMessage = redactString(error?.message || error || 'Operational alert');
        const alertKey = String(
            safeContext.alertKey || safeContext.event || safeContext.errorCode || safeContext.component || safeMessage
        ).slice(0, 180);
        const fingerprint = `${safeSeverity}:${alertKey}`;
        const currentTime = now();
        const previousTime = recentAlerts.get(fingerprint);

        const logMethod = safeSeverity === SEVERITY.INFO || safeSeverity === SEVERITY.WARNING ? 'warn' : 'error';
        const writeLog = typeof log?.[logMethod] === 'function' ? log[logMethod].bind(log) : log?.error?.bind(log);
        writeLog?.('Operational alert observed.', {
            event: 'operational_alert',
            severity: safeSeverity,
            message: safeMessage,
            ...safeContext,
        });

        if (previousTime !== undefined && currentTime - previousTime < dedupWindowMs) {
            counters.deduplicated += 1;
            return { deduplicated: true, dispatched: { webhook: false, email: false } };
        }

        recentAlerts.set(fingerprint, currentTime);
        if (recentAlerts.size > 500) {
            for (const [key, timestamp] of recentAlerts) {
                if (currentTime - timestamp >= dedupWindowMs) recentAlerts.delete(key);
            }
        }

        if (safeSeverity === SEVERITY.INFO) {
            return { deduplicated: false, dispatched: { webhook: false, email: false } };
        }

        const timestamp = new Date(currentTime).toISOString();
        const payload = {
            username: `SRE Bot - ${environment.toUpperCase()}`,
            embeds: [{
                title: `${safeSeverity.toUpperCase()} ALERT`,
                description: safeMessage,
                color: safeSeverity === SEVERITY.CRITICAL ? 15548997 : (safeSeverity === SEVERITY.HIGH ? 15105570 : 16776960),
                fields: [{ name: 'Context', value: `\`\`\`json\n${JSON.stringify(safeContext, null, 2).slice(0, 1000)}\n\`\`\`` }],
                footer: { text: `Servicios a tu Hogar | ${timestamp}` },
            }],
        };
        const tasks = [];
        const channels = [];

        if (webhookUrl) {
            tasks.push(httpClient.post(webhookUrl, payload));
            channels.push('webhook');
        }
        if (safeSeverity === SEVERITY.CRITICAL && adminEmail) {
            tasks.push(sendEmailFn({
                to: adminEmail,
                subject: `[CRITICAL] ${safeMessage.slice(0, 80)}`,
                html: `<h1>Alerta crítica</h1><p>${escapeHtml(safeMessage)}</p><p>${escapeHtml(timestamp)}</p><pre>${escapeHtml(JSON.stringify(safeContext, null, 2))}</pre>`,
            }));
            channels.push('email');
        }

        const settled = await Promise.allSettled(tasks);
        const dispatched = { webhook: false, email: false };
        settled.forEach((result, index) => {
            const channel = channels[index];
            if (result.status === 'fulfilled') {
                dispatched[channel] = true;
                counters[channel] += 1;
            } else {
                counters.deliveryFailures += 1;
                log?.error?.('Operational alert delivery failed.', {
                    event: 'alert_delivery_failed',
                    channel,
                    severity: safeSeverity,
                    errorCode: result.reason?.code || 'ALERT_DELIVERY_FAILED',
                });
            }
        });

        return { deduplicated: false, dispatched };
    };

    const getStats = () => ({ ...counters, activeFingerprints: recentAlerts.size });
    return { getStats, notify };
};

const alertService = createAlertService();

export const notify = alertService.notify;
export const getAlertStats = alertService.getStats;

export default alertService;
