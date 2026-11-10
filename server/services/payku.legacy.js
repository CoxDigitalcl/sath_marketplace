import axios from 'axios';
import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { getPaykuConfigForMode, getPaykuRuntimeConfig, getPaykuWebhookUrl } from './paykuConfig.js';
import { readPaykuCheckoutSettings } from './paykuCheckoutSettings.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
/**
 * Creates a Transaction in Payku
 * @param {string} orderId - Our internal Booking ID
 * @param {number} amount - Amount in CLP
 * @param {string} email - Payer Email
 * @param {string} subject - Description of purchase
 * @returns {Promise<{id: string, url: string, token: string}>}
 */
export const createTransaction = async (orderId, amount, email, subject, bookingCapability, checkoutPool = pool) => {
    const { mode } = await readPaykuCheckoutSettings(checkoutPool);
    const config = getPaykuConfigForMode(mode);
    if (!config) throw new Error('Payku checkout credentials are unavailable.');
    const { apiUrl, publicToken } = config;

    try {
        const payload = {
            email: email,
            order: orderId,
            subject: subject,
            amount: amount,
            currency: 'CLP',
            payment: 1, // Webpay
            urlreturn: `${process.env.APP_URL || 'https://serviciosatuhogar.cl'}/checkout/success?order=${orderId}${bookingCapability ? `#cap=${encodeURIComponent(bookingCapability)}` : ''}`,
            urlnotify: getPaykuWebhookUrl()
        };

        logger.info(`[Payku Service] Creating transaction for order ${orderId}, amount ${amount}. Notify: ${payload.urlnotify}`);

        const response = await axios.post(`${apiUrl}/transaction`, payload, {
            timeout: 10000,
            maxRedirects: 0,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicToken}`
            }
        });

        if (response.data?.url && response.data.id) {
            return {
                id: response.data.id,
                url: response.data.url,
                token: response.data.token,
                mode,
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
                url: `${process.env.APP_URL || ''}/checkout/success?mock_payment=true&order=${orderId}${bookingCapability ? `#cap=${encodeURIComponent(bookingCapability)}` : ''}`,
                token: 'mock_token',
                mode,
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
