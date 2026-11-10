import axios from 'axios';

import logger from '../config/logger.js';
import { getPaykuVerificationConfig } from './paykuConfig.js';

export { createTransaction } from './payku.legacy.js';

const safeIdentifier = (value) => String(value ?? '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 128);

export const verifyTransaction = async (transactionId, mode) => {
    const normalizedTransactionId = safeIdentifier(transactionId);
    if (!normalizedTransactionId) {
        const error = new Error('Invalid Payku transaction identifier.');
        error.code = 'INVALID_PAYKU_TRANSACTION_ID';
        throw error;
    }

    const config = getPaykuVerificationConfig(mode);
    if (!config) throw new Error('Payku verification credentials are unavailable.');
    const { apiUrl, publicToken } = config;

    try {
        const response = await axios.get(
            `${apiUrl}/transaction/${encodeURIComponent(normalizedTransactionId)}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${publicToken}`,
                },
                timeout: 10000,
                maxRedirects: 0,
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
