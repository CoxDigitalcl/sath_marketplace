const SANDBOX_API_URL = 'https://des.payku.cl/api';
const PRODUCTION_API_URL = 'https://app.payku.cl/api';
const PAYKU_MODES = new Set(['sandbox', 'production']);

const normalizeValue = (value) => typeof value === 'string' ? value.trim() : '';
export const isPaykuMode = (mode) => PAYKU_MODES.has(mode);

export const getPaykuWebhookUrl = (env = process.env) =>
    `${(env.API_URL || 'https://serviciosatuhogar.cl/api').replace(/\/+$/, '')}/bookings/webhook/payku`;

export const getPaykuRuntimeConfig = (env = process.env) => {
    const isProductionRuntime = env.NODE_ENV === 'production';
    const requestedMode = normalizeValue(env.PAYKU_MODE).toLowerCase();

    if (requestedMode && !PAYKU_MODES.has(requestedMode)) {
        throw new Error('PAYKU_MODE must be either sandbox or production.');
    }

    const apiUrl = normalizeValue(env.PAYKU_API_URL).replace(/\/+$/, '') || (isProductionRuntime ? '' : SANDBOX_API_URL);
    const publicToken = normalizeValue(env.PAYKU_PUBLIC_TOKEN) || (isProductionRuntime ? '' : 'demo');

    if (!apiUrl || !publicToken) {
        throw new Error('Payku configuration is incomplete.');
    }

    if (apiUrl !== SANDBOX_API_URL && apiUrl !== PRODUCTION_API_URL) {
        throw new Error('Payku API URL must match a supported Payku environment.');
    }
    const usesSandboxUrl = apiUrl === SANDBOX_API_URL;
    const usesDemoToken = publicToken === 'demo';

    if (requestedMode === 'sandbox') {
        if (!usesSandboxUrl || usesDemoToken) {
            throw new Error('Payku sandbox mode requires the sandbox API and non-demo credentials.');
        }
    } else if (requestedMode === 'production') {
        if (usesSandboxUrl || usesDemoToken) {
            throw new Error('Payku production mode cannot use sandbox/demo credentials.');
        }
    } else if (isProductionRuntime && (usesSandboxUrl || usesDemoToken)) {
        throw new Error('Payku production runtime requires PAYKU_MODE=sandbox to use sandbox credentials explicitly.');
    }

    return {
        apiUrl,
        publicToken,
        mode: requestedMode || (usesSandboxUrl ? 'sandbox' : 'production'),
    };
};

// The original server configuration remains the default for pre-switch bookings.
export const getDefaultPaykuMode = (env = process.env) => {
    const requestedMode = normalizeValue(env.PAYKU_MODE).toLowerCase();
    if (requestedMode) return isPaykuMode(requestedMode) ? requestedMode : null;
    const apiUrl = normalizeValue(env.PAYKU_API_URL).replace(/\/+$/, '');
    if (apiUrl === PRODUCTION_API_URL) return 'production';
    if (apiUrl === SANDBOX_API_URL || (!apiUrl && env.NODE_ENV !== 'production')) return 'sandbox';
    return null;
};

export const getPaykuConfigForMode = (mode, env = process.env) => {
    if (!isPaykuMode(mode)) return null;
    const sandbox = mode === 'sandbox';
    const token = normalizeValue(sandbox ? env.PAYKU_SANDBOX_PUBLIC_TOKEN : env.PAYKU_PRODUCTION_PUBLIC_TOKEN);
    if (token && token !== 'demo') {
        return { mode, publicToken: token, apiUrl: sandbox ? SANDBOX_API_URL : PRODUCTION_API_URL };
    }
    try {
        const fallback = getPaykuRuntimeConfig(env);
        return fallback.mode === mode ? fallback : null;
    } catch {
        return null;
    }
};

export const getPaykuVerificationConfig = (mode, env = process.env) => {
    if (mode != null) return getPaykuConfigForMode(mode, env);
    try {
        return getPaykuRuntimeConfig(env);
    } catch {
        return getPaykuConfigForMode(getDefaultPaykuMode(env), env);
    }
};

export default getPaykuRuntimeConfig;
