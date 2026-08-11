import axios from 'axios';

import logger from '../config/logger.js';

export { createTransaction } from './payku.legacy.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SANDBOX_API_URL = 'https://des.payku.cl/api';

const getPaykuVerificationConfig = () => {
    const apiUrl = process.env.PAYKU_API_URL || (IS_PRODUCTION ? null : SANDBOX_API_URL);
    const publicToken = process.env.PAYKU_PUBLIC_TOKEN || (IS_PRODUCTION ? null : 'demo');

    if (!apiUrl || !publicToken) {
        throw new Error('Payku verification configuration is incomplete.');
    }
    if (IS_PRODUCTION && (publicToken === 'demo' || apiUrl.includes('des.payku.cl'))) {
        throw new Error('Payku production verification points to sandbox/demo credentials.');
    }

    return { apiUrl, publicToken };
};

const safeIdentifier = (value) => String(value ?? '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 128);

export const verifyTransaction = async (transactionId) => {
    const normalizedTransactionId = safeIdentifier(transactionId);
    if (!normalizedTransactionId) {
        const error = new Error('Invalid Payku transaction identifier.');
        error.code = 'INVALID_PAYKU_TRANSACTION_ID';
        throw error;
    }

    const { apiUrl, publicToken } = getPaykuVerificationConfig();

    try {
        const response = await axios.get(
            `${apiUrl}/transaction/${encodeURIComponent(normalizedTransactionId)}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${publicToken}`,
                },
                timeout: 10000,
            }
        );
        const status = typeof response.data?.status === 'string'
            ? response.data.status.slice(0, 32)
            : 'unknown';

        logger.info('[Payku Verify] Verification completed', {
            transactionId: normalizedTransactionId,
            status,
        });
        return response.data;
    } catch (error) {
        logger.error('[Payku Verify] Verification failed', {
            transactionId: normalizedTransactionId,
            errorCode: error?.code || 'PAYKU_VERIFICATION_FAILED',
        });
        throw error;
    }
};

export { default as legacyPaykuService } from './payku.legacy.js';

export default {
    createTransaction: (...args) => import('./payku.legacy.js').then((module) => module.createTransaction(...args)),
    verifyTransaction,
};
