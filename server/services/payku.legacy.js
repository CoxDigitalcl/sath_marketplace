import axios from 'axios';
import logger from '../config/logger.js';
import { getPaykuRuntimeConfig } from './paykuConfig.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
/**
 * Creates a Transaction in Payku
 * @param {string} orderId - Our internal Booking ID
 * @param {number} amount - Amount in CLP
 * @param {string} email - Payer Email
 * @param {string} subject - Description of purchase
 * @returns {Promise<{id: string, url: string, token: string}>}
 */
export const createTransaction = async (orderId, amount, email, subject) => {
    const { apiUrl, publicToken } = getPaykuRuntimeConfig();

    try {
        const payload = {
            email: email,
            order: orderId,
            subject: subject,
            amount: amount,
            currency: 'CLP',
            payment: 1, // 1 = Webpay / Flow / Etc (Check Payku Docs, usually 1 or 2)
            urlreturn: `${process.env.APP_URL || 'https://serviciosatuhogar.cl'}/checkout/success?order=${orderId}`,
            urlnotify: `${process.env.API_URL || 'https://serviciosatuhogar.cl/api'}/bookings/webhook/payku`
        };

        logger.info(`[Payku Service] Creating transaction for order ${orderId}, amount ${amount}. Notify: ${payload.urlnotify}`);

        const response = await axios.post(`${apiUrl}/transaction`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicToken}`
            }
        });

        if (response.data && response.data.url) {
            return {
                id: response.data.id,
                url: response.data.url,
                token: response.data.token
            };
        }

        throw new Error('Invalid Payku Response');

    } catch (error) {
        logger.error(`Payku Transaction Error: ${error.message}`);

        // FAILSAFE FOR DEV WITHOUT KEYS:
        // If we consistently fail because of missing keys, let's return a "Mock" Payku URL 
        // that redirects back to success so the User can test the flow.
        if (!IS_PRODUCTION && publicToken === 'demo') {
            logger.warn("Using Mock Payku Response in Sandbox Mode");
            return {
                id: `mock_${Math.random()}`,
                url: `${process.env.APP_URL || ''}/checkout?mock_payment=true&order=${orderId}`,
                token: 'mock_token'
            };
        }

        throw error;
    }
};

/**
 * Verify a transaction status directly with Payku API
 * Used as fallback when webhook hasn't arrived yet (timing issue)
 * @param {string} transactionId - Payku transaction ID
 * @returns {Promise<{status: string, order: string, transaction_id: string}>}
 */
export const verifyTransaction = async (transactionId) => {
    const { apiUrl, publicToken } = getPaykuRuntimeConfig();

    try {
        const response = await axios.get(`${apiUrl}/transaction/${transactionId}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicToken}`
            }
        });

        logger.info(`[Payku Verify] Transaction ${transactionId} status: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        logger.error(`[Payku Verify] Error: ${error.message}`);
        throw error;
    }
};

export default { createTransaction, verifyTransaction };
