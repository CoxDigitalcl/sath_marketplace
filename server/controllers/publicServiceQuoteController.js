import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { calculateServicePricing } from '../services/commissionService.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUOTE_UNITS = 24;

const parseQuoteUnits = (value) => {
    const raw = String(value ?? '1');
    if (!/^\d+$/.test(raw)) return null;

    const units = Number(raw);
    return Number.isSafeInteger(units) && units >= 1 && units <= MAX_QUOTE_UNITS
        ? units
        : null;
};

export const getServiceQuote = async (req, res) => {
    const { id } = req.params;
    if (!UUID_PATTERN.test(id)) {
        return res.status(400).json({
            status: 'error',
            message: 'Identificador de servicio invalido.',
            code: 'INVALID_SERVICE_ID'
        });
    }

    const requestedUnits = parseQuoteUnits(req.query.units);
    if (requestedUnits === null) {
        return res.status(400).json({
            status: 'error',
            message: `Las unidades deben ser un entero entre 1 y ${MAX_QUOTE_UNITS}.`,
            code: 'INVALID_QUOTE_UNITS'
        });
    }

    try {
        const result = await pool.query(
            `SELECT s.id, s.price, s.pricing_type, s.category, s.categories_json
             FROM services s
             JOIN provider_profiles p ON p.user_id = s.provider_id
             JOIN users u ON u.id = s.provider_id
             WHERE s.id = $1
               AND s.is_active = TRUE
               AND p.is_verified = TRUE
               AND s.moderation_status = 'approved'
               AND COALESCE(u.is_blocked, FALSE) = FALSE
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Servicio no encontrado.'
            });
        }

        const service = result.rows[0];
        const billableUnits = service.pricing_type === 'per_hour' ? requestedUnits : 1;
        const unitPrice = Number(service.price);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error('Invalid service price');
        }

        const pricing = await calculateServicePricing(service, unitPrice * billableUnits);
        return res.json({
            status: 'success',
            pricing: {
                baseAmount: pricing.baseAmount,
                serviceFee: pricing.platformFee,
                totalAmount: pricing.totalAmount,
                units: billableUnits,
                currency: 'CLP'
            }
        });
    } catch (err) {
        logger.error(`Public service quote failed: ${err.message}`);
        return res.status(500).json({
            status: 'error',
            message: 'No se pudo calcular el total del servicio.'
        });
    }
};
