import axios from 'axios';
import { getDefaultPaykuMode, getPaykuConfigForMode, getPaykuWebhookUrl, isPaykuMode } from './paykuConfig.js';

const isPaykuTransactionResponse = (data) => Array.isArray(data?.transaction) || (
    // Payku can return one record directly when the page contains a single transaction.
    typeof data?.id === 'string' && typeof data.order === 'string' &&
    typeof data.status === 'string' && data.status !== 'failed' &&
    data.gateway_response && typeof data.gateway_response === 'object'
);

export class PaykuCheckoutSettingsError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export const readPaykuCheckoutSettings = async (pool, env = process.env) => {
    const { rows } = await pool.query('SELECT mode, revision FROM payku_checkout_settings WHERE singleton');
    return rows[0] || { mode: getDefaultPaykuMode(env), revision: 0 };
};

export const describePaykuCheckout = (settings, env = process.env) => {
    const isConfigured = (mode) => {
        const config = getPaykuConfigForMode(mode, env);
        return Boolean(config && config.publicToken !== 'demo');
    };
    return {
        ...settings,
        configured: { sandbox: isConfigured('sandbox'), production: isConfigured('production') },
        webhookUrl: getPaykuWebhookUrl(env),
    };
};

export const updatePaykuCheckoutMode = async ({ pool, env = process.env, mode, revision, actorId, http = axios }) => {
    if (!isPaykuMode(mode) || !Number.isInteger(revision) || revision < 0 || revision >= 2147483647) {
        throw new PaykuCheckoutSettingsError(400, 'El cambio de ambiente solicitado no es válido.');
    }
    const current = await readPaykuCheckoutSettings(pool, env);
    const conflict = () => new PaykuCheckoutSettingsError(409, 'Otro administrador cambió el ambiente. Revisa el estado actual.');
    if (current.revision !== revision) throw conflict();
    if (current.mode === mode) return current;

    const config = getPaykuConfigForMode(mode, env);
    if (!config || config.publicToken === 'demo') {
        throw new PaykuCheckoutSettingsError(422, 'Faltan las credenciales de Payku para ese ambiente en el servidor.');
    }

    try {
        const response = await http.get(`${config.apiUrl}/transaction`, {
            headers: { Authorization: `Bearer ${config.publicToken}`, Accept: 'application/json' },
            params: { page: 1, per_page: 1 },
            timeout: 10000,
            maxRedirects: 0,
        });
        if (!isPaykuTransactionResponse(response.data)) throw new Error('Unexpected Payku response');
    } catch {
        throw new PaykuCheckoutSettingsError(502, 'No se pudo validar el acceso a Payku en ese ambiente. Revisa las credenciales o intenta nuevamente.');
    }

    const { rows } = await pool.query(
        `INSERT INTO payku_checkout_settings (singleton, mode, revision, updated_by)
         VALUES (TRUE, $1, 1, $2)
         ON CONFLICT (singleton) DO UPDATE
         SET mode = EXCLUDED.mode, revision = payku_checkout_settings.revision + 1,
             updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
         WHERE payku_checkout_settings.revision = $3
         RETURNING mode, revision`,
        [mode, actorId, revision]
    );
    if (!rows[0]) throw conflict();
    return rows[0];
};
