import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import {
    describePaykuCheckout,
    PaykuCheckoutSettingsError,
    readPaykuCheckoutSettings,
    updatePaykuCheckoutMode,
} from '../services/paykuCheckoutSettings.js';

export const getPaykuCheckout = async (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
        const settings = await readPaykuCheckoutSettings(pool);
        return res.json({ status: 'success', data: describePaykuCheckout(settings) });
    } catch (error) {
        return next(error);
    }
};

export const setPaykuCheckoutMode = async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
        const { mode, revision } = req.body || {};
        const settings = await updatePaykuCheckoutMode({ pool, mode, revision, actorId: req.user.id });
        if (settings.revision !== revision) {
            logger.info('[Payku] Checkout environment changed', {
                mode: settings.mode,
                revision: settings.revision,
                adminId: req.user.id,
            });
        }
        return res.json({ status: 'success', data: describePaykuCheckout(settings) });
    } catch (error) {
        if (error instanceof PaykuCheckoutSettingsError) {
            return res.status(error.status).json({ status: 'error', message: error.message });
        }
        return next(error);
    }
};
