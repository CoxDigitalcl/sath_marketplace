import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { ensureBookingPricingColumns, getBookingPricingFromRow } from '../services/commissionService.js';

// Ensure billing_info table exists (Lazy Migration)
const ensureBillingTableExists = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS billing_info (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        billing_type VARCHAR(20) DEFAULT 'person',
        rut VARCHAR(20),
        full_name VARCHAR(255),
        company_name VARCHAR(255),
        company_business VARCHAR(255),
        address VARCHAR(255),
        city VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    `;
    await pool.query(query);
};

// GET /api/billing
// Get billing info for current user
export const getBillingInfo = async (req, res, next) => {
    try {
        await ensureBillingTableExists();
        const userId = req.user.id;

        const result = await pool.query(
            'SELECT * FROM billing_info WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            // Return empty defaults
            return res.json({
                status: 'success',
                billingInfo: {
                    billingType: 'person',
                    rut: '',
                    fullName: '',
                    companyName: '',
                    companyBusiness: '',
                    address: '',
                    city: ''
                }
            });
        }

        const row = result.rows[0];
        res.json({
            status: 'success',
            billingInfo: {
                billingType: row.billing_type,
                rut: row.rut || '',
                fullName: row.full_name || '',
                companyName: row.company_name || '',
                companyBusiness: row.company_business || '',
                address: row.address || '',
                city: row.city || ''
            }
        });

    } catch (err) {
        logger.error(`Get Billing Info Error: ${err.message}`);
        next(err);
    }
};

// PUT /api/billing
// Update or create billing info
export const updateBillingInfo = async (req, res, next) => {
    try {
        await ensureBillingTableExists();
        const userId = req.user.id;
        const {
            billing_type,
            rut,
            full_name,
            company_name,
            company_business,
            address,
            city
        } = req.body;

        // Upsert billing info
        const query = `
            INSERT INTO billing_info 
            (user_id, billing_type, rut, full_name, company_name, company_business, address, city)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                billing_type = $2,
                rut = $3,
                full_name = $4,
                company_name = $5,
                company_business = $6,
                address = $7,
                city = $8,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pool.query(query, [
            userId,
            billing_type || 'person',
            rut,
            full_name,
            company_name,
            company_business,
            address,
            city
        ]);

        res.json({
            status: 'success',
            message: 'Información de facturación actualizada',
            billingInfo: result.rows[0]
        });

    } catch (err) {
        logger.error(`Update Billing Info Error: ${err.message}`);
        next(err);
    }
};

// GET /api/billing/invoices
// Get invoice history from completed bookings
export const getInvoices = async (req, res, next) => {
    try {
        await ensureBookingPricingColumns();
        const userId = req.user.id;

        // Platform invoices/boletas are generated only for the platform service fee.
        const query = `
            SELECT 
                b.id,
                b.amount,
                b.base_amount,
                b.platform_fee,
                b.commission_rate,
                b.commission_type,
                b.fixed_commission,
                b.invoice_url,
                b.invoice_folio,
                b.invoice_status,
                b.created_at,
                b.status,
                s.title as service_name,
                sc.commission_percentage as category_commission_percentage,
                sc.commission_type as category_commission_type,
                sc.fixed_commission as category_fixed_commission
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE b.client_id = $1 
              AND b.status IN ('in_escrow', 'service_completed', 'released', 'disputed')
            ORDER BY b.created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const invoices = result.rows.map((row, index) => {
            const pricing = getBookingPricingFromRow(row);
            return {
                id: row.invoice_folio || `BOL-${new Date(row.created_at).getFullYear()}-${(index + 1).toString().padStart(4, '0')}`,
                bookingId: row.id,
                serviceName: `Tarifa plataforma - ${row.service_name}`,
                date: row.created_at,
                amount: pricing.platformFee,
                status: row.invoice_status || row.status,
                url: row.invoice_url
            };
        });

        res.json({
            status: 'success',
            count: invoices.length,
            invoices
        });

    } catch (err) {
        logger.error(`Get Invoices Error: ${err.message}`);
        next(err);
    }
};
