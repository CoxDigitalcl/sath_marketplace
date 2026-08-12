const SANDBOX_API_URL = 'https://des.payku.cl/api';
const PAYKU_MODES = new Set(['sandbox', 'production']);

const normalizeValue = (value) => typeof value === 'string' ? value.trim() : '';

export const getPaykuRuntimeConfig = (env = process.env) => {
    const isProductionRuntime = env.NODE_ENV === 'production';
    const requestedMode = normalizeValue(env.PAYKU_MODE).toLowerCase();

    if (requestedMode && !PAYKU_MODES.has(requestedMode)) {
        throw new Error('PAYKU_MODE must be either sandbox or production.');
    }

    const apiUrl = normalizeValue(env.PAYKU_API_URL) || (isProductionRuntime ? '' : SANDBOX_API_URL);
    const publicToken = normalizeValue(env.PAYKU_PUBLIC_TOKEN) || (isProductionRuntime ? '' : 'demo');

    if (!apiUrl || !publicToken) {
        throw new Error('Payku configuration is incomplete.');
    }

    const usesSandboxUrl = apiUrl.includes('des.payku.cl');
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

export default getPaykuRuntimeConfig;
