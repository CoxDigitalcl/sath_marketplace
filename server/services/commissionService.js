import { pool } from '../config/db.js';
import logger from '../config/logger.js';

const DEFAULT_COMMISSION_PERCENTAGE = 10;
let pricingColumnsPromise = null;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const parseJson = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    return value;
};

export const ensureBookingPricingColumns = async () => {
    if (!pricingColumnsPromise) {
        pricingColumnsPromise = pool.query(`
            ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS base_amount INTEGER,
            ADD COLUMN IF NOT EXISTS platform_fee INTEGER,
            ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(8,4),
            ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20),
            ADD COLUMN IF NOT EXISTS fixed_commission INTEGER,
            ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE
        `).catch((err) => {
            pricingColumnsPromise = null;
            logger.error(`[Commission] Could not ensure booking pricing columns: ${err.message}`);
            throw err;
        });
    }
    return pricingColumnsPromise;
};

export const getPrimaryCategoryId = (service = {}) => {
    if (service.category) return service.category;

    const categories = parseJson(service.categories_json, []);
    if (Array.isArray(categories) && categories.length > 0) {
        const first = categories[0];
        return first.categoryId || first.category_id || first.id || null;
    }

    return null;
};

export const normalizeCommissionConfig = (row = {}, categoryId = null) => {
    const commissionType = (row.commission_type || row.commissionType || 'PERCENTAGE').toUpperCase();
    return {
        categoryId,
        commissionType: commissionType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
        commissionPercentage: toNumber(row.commission_percentage ?? row.commission ?? row.commissionRate, DEFAULT_COMMISSION_PERCENTAGE),
        fixedCommission: toNumber(row.fixed_commission ?? row.fixedCommission, 0)
    };
};

export const getCommissionConfigForService = async (service = {}, db = pool) => {
    const categoryId = getPrimaryCategoryId(service);
    if (!categoryId) {
        return normalizeCommissionConfig({}, null);
    }

    try {
        const result = await db.query(
            `SELECT id, commission_percentage, commission_type, fixed_commission
             FROM service_categories
             WHERE id = $1 AND is_active = TRUE
             LIMIT 1`,
            [categoryId]
        );

        if (result.rows.length > 0) {
            return normalizeCommissionConfig(result.rows[0], categoryId);
        }
    } catch (err) {
        if (err.code !== '42P01') {
            logger.warn(`[Commission] Could not load category commission for ${categoryId}: ${err.message}`);
        }
    }

    return normalizeCommissionConfig({}, categoryId);
};

export const calculateCommission = (baseAmount, config = {}) => {
    const safeBaseAmount = Math.max(0, Math.round(toNumber(baseAmount, 0)));
    const normalizedConfig = normalizeCommissionConfig(config, config.categoryId || null);

    const platformFee = normalizedConfig.commissionType === 'FIXED'
        ? Math.max(0, Math.round(normalizedConfig.fixedCommission))
        : Math.max(0, Math.round(safeBaseAmount * (normalizedConfig.commissionPercentage / 100)));

    return {
        baseAmount: safeBaseAmount,
        platformFee,
        totalAmount: safeBaseAmount + platformFee,
        commissionType: normalizedConfig.commissionType,
        commissionRate: normalizedConfig.commissionType === 'PERCENTAGE'
            ? normalizedConfig.commissionPercentage / 100
            : (safeBaseAmount > 0 ? platformFee / safeBaseAmount : 0),
        commissionPercentage: normalizedConfig.commissionPercentage,
        fixedCommission: normalizedConfig.fixedCommission
    };
};

export const calculateServicePricing = async (service, baseAmount, db = pool) => {
    const config = await getCommissionConfigForService(service, db);
    return calculateCommission(baseAmount, config);
};

export const getBookingPricingFromRow = (row = {}) => {
    const totalAmount = Math.max(0, Math.round(toNumber(row.amount, 0)));

    if (row.base_amount !== null && row.base_amount !== undefined && row.platform_fee !== null && row.platform_fee !== undefined) {
        const baseAmount = Math.max(0, Math.round(toNumber(row.base_amount, totalAmount)));
        const platformFee = Math.max(0, Math.round(toNumber(row.platform_fee, 0)));
        return {
            baseAmount,
            platformFee,
            totalAmount,
            commissionType: (row.commission_type || 'PERCENTAGE').toUpperCase(),
            commissionRate: toNumber(row.commission_rate, baseAmount > 0 ? platformFee / baseAmount : 0),
            fixedCommission: toNumber(row.fixed_commission, 0)
        };
    }

    const fallback = calculateCommission(totalAmount, {
        commission_type: row.category_commission_type || row.commission_type,
        commission_percentage: row.category_commission_percentage ?? row.commission_percentage,
        fixed_commission: row.category_fixed_commission ?? row.fixed_commission
    });

    return {
        ...fallback,
        totalAmount
    };
};
