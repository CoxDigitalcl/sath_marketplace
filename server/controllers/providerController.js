import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import { buildCoverageArea, normalizeOptionalCoverageInput, parseCoverageCommunes } from '../../shared/chileLocations.js';
import cacheService from '../services/cacheService.js';
import { notifyAdmin } from '../services/notificationService.js';
import { notifyAllAdmins } from './notificationController.js';
import { ensureBookingPricingColumns, getBookingPricingFromRow } from '../services/commissionService.js';
import { getPublicProviderName } from '../utils/publicDtos.js';
import { isValidUuid } from '../utils/identifiers.js';

// Helper: Get valid KYC field IDs from DB
const getActiveKycFieldIds = async () => {
    try {
        const result = await pool.query("SELECT id FROM verification_requirements WHERE is_active = true");
        return result.rows.map(r => r.id);
    } catch (err) {
        // Fallback if table doesn't exist yet
        logger.warn('[KYC] verification_requirements table not found, using defaults');
        return ['kyc_id_front', 'kyc_id_back', 'kyc_sii', 'kyc_address', 'kyc_criminal_record'];
    }
};

// Helper: Get mandatory KYC field IDs from DB
const getMandatoryKycFieldIds = async () => {
    try {
        const result = await pool.query("SELECT id FROM verification_requirements WHERE is_active = true AND is_mandatory = true");
        return result.rows.map(r => r.id);
    } catch (err) {
        return ['kyc_id_front', 'kyc_id_back', 'kyc_sii', 'kyc_address', 'kyc_criminal_record'];
    }
};

const normalizePrivateKycDocumentUrls = (documents = {}) => {
    if (!documents || typeof documents !== 'object') return documents;

    return Object.fromEntries(Object.entries(documents).map(([key, doc]) => {
        if (!doc || typeof doc !== 'object') return [key, doc];
        const filename = typeof doc.url === 'string' && doc.url.startsWith('/uploads/')
            ? doc.url.split('/').pop()
            : null;

        if (filename && filename.startsWith('kyc_')) {
            return [key, { ...doc, url: `/api/files/private/${filename}` }];
        }

        return [key, doc];
    }));
};

const getPublicCoverage = (profile = {}) => {
    const communes = parseCoverageCommunes(profile.coverage_communes);
    const hasStructuredCoverage = Boolean(profile.coverage_region_code && communes.length > 0);

    if (!hasStructuredCoverage) {
        return {
            location: 'Cobertura por confirmar',
            coverage_region_code: null,
            coverage_region_name: null,
            coverage_communes: [],
            coverage_area: null
        };
    }

    const coverageArea = profile.coverage_area || buildCoverageArea(profile.coverage_region_name, communes);

    return {
        location: coverageArea,
        coverage_region_code: profile.coverage_region_code,
        coverage_region_name: profile.coverage_region_name,
        coverage_communes: communes,
        coverage_area: coverageArea
    };
};

// GET /api/provider/kyc-requirements
export const getProviderKycRequirements = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, file_type, accepted_formats, max_file_size_mb, 
                    expiration_required, is_mandatory, sort_order
             FROM verification_requirements 
             WHERE is_active = true 
             ORDER BY sort_order ASC, name ASC`
        );
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        // Fallback if table doesn't exist
        if (err.code === '42P01') {
            return res.json({
                status: 'success',
                data: [
                    { id: 'kyc_id_front', name: 'Cédula de Identidad (Frente)', file_type: 'image', accepted_formats: '.jpg,.jpeg,.png', is_mandatory: true, sort_order: 1 },
                    { id: 'kyc_id_back', name: 'Cédula de Identidad (Dorso)', file_type: 'image', accepted_formats: '.jpg,.jpeg,.png', is_mandatory: true, sort_order: 2 },
                    { id: 'kyc_sii', name: 'Carpeta Tributaria (SII)', file_type: 'document', accepted_formats: '.pdf,.jpg,.jpeg,.png', is_mandatory: true, sort_order: 3 },
                    { id: 'kyc_address', name: 'Comprobante de Domicilio', file_type: 'document', accepted_formats: '.pdf,.jpg,.jpeg,.png', is_mandatory: true, sort_order: 4 },
                    { id: 'kyc_criminal_record', name: 'Certificado de Antecedentes', file_type: 'document', accepted_formats: '.pdf', is_mandatory: true, sort_order: 5 }
                ]
            });
        }
        next(err);
    }
};

// POST /api/provider/profile
export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            full_name,
            phone,
            bio,
            store_name,
            contact_email,
            public_phone,
            public_website,
            instagram_handle,
            bank_data,
            coverage_region_code,
            coverage_communes
        } = req.body;

        if (!contact_email || !public_phone) {
            return res.status(400).json({ status: 'error', message: 'El correo y teléfono de contacto directo son obligatorios.' });
        }

        // Files from Multer (upload.any() returns an array)
        const rawFiles = req.files || [];
        
        // Convert array to object grouped by fieldname for easier access
        const files = {};
        rawFiles.forEach(file => {
            if (!files[file.fieldname]) files[file.fieldname] = [];
            files[file.fieldname].push(file);
        });

        logger.info(`[Profile Update] User: ${userId}, Fields received: ${Object.keys(req.body).join(', ')}, Files received: ${Object.keys(files).join(', ') || 'none'}`);

        // 1. Prepare KYC Documents & Images
        let profileUpdates = {};
        let kycDocsUpdates = {};

        // Profile & Banner Images
        let hasNewImages = false;
        if (files['profile_image']) {
            profileUpdates.profile_image_url = `/uploads/${files['profile_image'][0].filename}`;
            hasNewImages = true;
        }
        if (files['banner_image']) {
            profileUpdates.banner_image_url = `/uploads/${files['banner_image'][0].filename}`;
            hasNewImages = true;
        }

        // KYC Documents — dynamically from DB
        const validKycFields = await getActiveKycFieldIds();
        let hasNewKyc = false;

        // Also accept any field starting with 'kyc_' that exists in valid fields
        const allFileFields = Object.keys(files);
        const invalidKycField = allFileFields.find(
            field => field.startsWith('kyc_') && !validKycFields.includes(field)
        );
        if (invalidKycField) {
            return res.status(400).json({
                status: 'error',
                message: 'El documento KYC no corresponde a un requisito vigente.',
                code: 'INVALID_KYC_FIELD'
            });
        }

        for (const field of allFileFields) {
            if (field.startsWith('kyc_') && validKycFields.includes(field)) {
                kycDocsUpdates[field] = {
                    url: `/api/files/private/${files[field][0].filename}`,
                    status: 'pending',
                    uploadDate: new Date().toISOString()
                };
                hasNewKyc = true;
            }
        }

        // 2. Fetch existing profile to merge KYC json
        const currentProfileRes = await pool.query('SELECT kyc_documents, full_name, user_id FROM provider_profiles WHERE user_id = $1', [userId]);

        if (currentProfileRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Provider profile not found' });
        }

        const currentProfile = currentProfileRes.rows[0];
        let currentDocs = currentProfile.kyc_documents || {};
        
        // MED-06: Check if re-upload overwrites a previously approved document
        let revokeVerification = false;
        for (const field of Object.keys(kycDocsUpdates)) {
            if (currentDocs[field] && currentDocs[field].status === 'approved') {
                logger.info(`[KYC] Provider ${userId} re-uploading approved doc: ${field}. Revoking verification.`);
                revokeVerification = true;
            }
        }
        
        const finalDocs = { ...currentDocs, ...kycDocsUpdates };

        // Sanitize bank_data
        let safeBankData = null;
        if (bank_data && typeof bank_data === 'string' && bank_data.trim() !== '') {
            try {
                JSON.parse(bank_data);
                safeBankData = bank_data;
            } catch (e) {
                logger.warn(`[Profile Update] Invalid bank_data JSON from user ${userId}: ${bank_data}`);
            }
        }

        const hasCoverageInput =
            Object.prototype.hasOwnProperty.call(req.body, 'coverage_region_code') ||
            Object.prototype.hasOwnProperty.call(req.body, 'coverage_communes');
        let normalizedCoverage = null;

        if (hasCoverageInput) {
            try {
                normalizedCoverage = normalizeOptionalCoverageInput({
                    coverage_region_code,
                    coverage_communes
                });
            } catch (coverageErr) {
                return res.status(400).json({ status: 'error', message: coverageErr.message });
            }
        }

        const updateQuery = `
          UPDATE provider_profiles 
          SET 
            full_name = COALESCE($2, full_name),
            phone = COALESCE($3, phone),
            bio = COALESCE($4, bio),
            store_name = COALESCE($5, store_name),
            contact_email = COALESCE($6, contact_email),
            public_phone = COALESCE($7, public_phone),
            public_website = COALESCE($8, public_website),
            instagram_handle = COALESCE($9, instagram_handle),
            profile_image_url = COALESCE($10, profile_image_url),
            banner_image_url = COALESCE($11, banner_image_url),
            profile_image_status = CASE WHEN $10::text IS NOT NULL THEN 'pending' ELSE profile_image_status END,
            profile_image_rejection_reason = CASE WHEN $10::text IS NOT NULL THEN NULL ELSE profile_image_rejection_reason END,
            banner_image_status = CASE WHEN $11::text IS NOT NULL THEN 'pending' ELSE banner_image_status END,
            banner_image_rejection_reason = CASE WHEN $11::text IS NOT NULL THEN NULL ELSE banner_image_rejection_reason END,
            kyc_documents = $12,
            bank_data = COALESCE($13::jsonb, bank_data),
            coverage_region_code = CASE WHEN $14::boolean THEN $15 ELSE coverage_region_code END,
            coverage_region_name = CASE WHEN $14::boolean THEN $16 ELSE coverage_region_name END,
            coverage_communes = CASE WHEN $14::boolean THEN $17::jsonb ELSE coverage_communes END,
            coverage_area = CASE WHEN $14::boolean THEN $18 ELSE coverage_area END,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
          RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            userId,
            full_name || null,
            phone || null,
            bio || null,
            store_name || null,
            contact_email || null,
            public_phone || null,
            public_website || null,
            instagram_handle || null,
            profileUpdates.profile_image_url || null,
            profileUpdates.banner_image_url || null,
            JSON.stringify(finalDocs),
            safeBankData,
            hasCoverageInput,
            normalizedCoverage?.coverage_region_code ?? null,
            normalizedCoverage?.coverage_region_name ?? null,
            JSON.stringify(normalizedCoverage?.coverage_communes ?? []),
            normalizedCoverage?.coverage_area ?? null
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Provider profile not found' });
        }

        // MED-06: Revoke is_verified if an approved doc was re-uploaded
        if (hasNewKyc && revokeVerification) {
            await pool.query('UPDATE provider_profiles SET is_verified = false WHERE user_id = $1', [userId]);
            logger.info(`[KYC] Provider ${userId} verification revoked due to re-upload of approved document.`);
        }

        // Notify Admin if KYC uploaded
        if (hasNewKyc) {
            notifyAdmin('KYC_UPLOADED', {
                providerName: currentProfile.full_name || 'Sin nombre',
                email: req.user.email,
                userId: userId
            });
            notifyAllAdmins({
                title: revokeVerification ? '⚠️ Documentos KYC re-subidos (verificación revocada)' : 'Nuevos documentos KYC',
                message: `${currentProfile.full_name || req.user.email} subió documentos de verificación.${revokeVerification ? ' La verificación fue revocada automáticamente.' : ''}`,
                type: 'kyc',
                link: '/admin?view=providers'
            });
        }
        
        // Notify Admin if Images uploaded
        if (hasNewImages) {
            notifyAdmin('IMAGE_UPLOADED', {
                providerName: currentProfile.full_name || 'Sin nombre',
                email: req.user.email,
                userId: userId
            });
            notifyAllAdmins({
                title: 'Nueva imagen para moderar',
                message: `${currentProfile.full_name || req.user.email} subió una nueva imagen de perfil/banner.`,
                type: 'moderation',
                link: '/admin?view=moderation'
            });
        }

        try {
            cacheService.flush();
        } catch (cacheErr) {
            logger.warn(`Could not clear public service cache after provider coverage change: ${cacheErr.message}`);
        }

        res.json({
            status: 'success',
            message: 'Profile updated successfully',
            profile: {
                ...result.rows[0],
                kyc_documents: normalizePrivateKycDocumentUrls(result.rows[0].kyc_documents)
            }
        });

    } catch (err) {
        logger.error(`Provider Profile Update Error: ${err.message}`);
        next(err);
    }
};

// GET /api/provider/profile
export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await pool.query('SELECT * FROM provider_profiles WHERE user_id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Profile not found' });
        }

        res.json({
            status: 'success',
            profile: {
                ...result.rows[0],
                kyc_documents: normalizePrivateKycDocumentUrls(result.rows[0].kyc_documents)
            }
        });
    } catch (err) {
        next(err);
    }
};

const mapStatusToLabel = (status) => {
    const map = {
        'pending_payment': 'Pendiente',
        'confirmed': 'Confirmado',
        'completed': 'Entregado', // Or Completed
        'cancelled': 'Cancelado'
    };
    return map[status] || status;
};

// GET /api/provider/dashboard-stats
export const getDashboardStats = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // 1. Income Stats (Paid orders)
        // Correct DB statuses: pending_payment, in_escrow, service_completed, released
        // - in_escrow: Payment received, service pending
        // - service_completed: Work done, awaiting release
        // - released: Funds released (completed)

        await ensureBookingPricingColumns();
        const incomeQuery = `
            SELECT b.amount, b.base_amount, b.platform_fee, b.commission_rate, b.commission_type, b.fixed_commission,
                   b.status,
                   sc.commission_percentage as category_commission_percentage,
                   sc.commission_type as category_commission_type,
                   sc.fixed_commission as category_fixed_commission
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE b.provider_id = $1 AND b.status IN ('in_escrow', 'service_completed', 'released')
        `;
        const incomeRes = await pool.query(incomeQuery, [userId]);

        const totalSales = incomeRes.rows.reduce((sum, row) => sum + (parseInt(row.amount, 10) || 0), 0);
        const commissionPaid = incomeRes.rows.reduce((sum, row) => sum + getBookingPricingFromRow(row).platformFee, 0);
        const pendingPayout = incomeRes.rows.reduce((sum, row) => {
            if (!['in_escrow', 'service_completed'].includes(row.status)) return sum;
            const pricing = getBookingPricingFromRow(row);
            return sum + Math.max(0, (parseInt(row.amount, 10) || 0) - pricing.platformFee);
        }, 0);

        const incomeStats = {
            totalSales,
            ordersCount: incomeRes.rows.length,
            commissionPaid,
            pendingPayout
        };

        // 2. Asset Stats (Active Services/Products)
        const servicesRes = await pool.query('SELECT COUNT(*) as count FROM services WHERE provider_id = $1 AND is_active = true', [userId]);
        // Mock products for now as we don't have products table structure confirmed yet? Or assuming yes.
        // If products table exists: await pool.query('SELECT COUNT(*) FROM products WHERE provider_id = $1', [userId]);
        // For now returning 0 or mock for products.
        const assetStats = {
            activeServices: parseInt(servicesRes.rows[0].count),
            activeProducts: 0,
            lowStock: 0
        };

        // 3. Reputation (from reviews table)
        let avgRating = 0;
        let pendingReviews = 0;
        try {
            const ratingRes = await pool.query(
                'SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count FROM reviews WHERE provider_id = $1',
                [userId]
            );
            avgRating = parseFloat(ratingRes.rows[0].avg_rating) || 0;
            avgRating = Math.round(avgRating * 10) / 10; // Round to 1 decimal
        } catch (e) {
            // Reviews table may not exist yet or has no data
            console.warn('Could not fetch reviews:', e.message);
        }

        const reputationStats = {
            avgRating,
            pendingReviews
        };

        // 4. Recent Activity (Last 5 bookings)
        const activityQuery = `
            SELECT 
                b.id,
                'service' as type,
                s.title as item,
                u.email as customer_email,
                b.created_at as date,
                b.amount,
                b.status
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN users u ON b.client_id = u.id
            WHERE b.provider_id = $1
            ORDER BY b.created_at DESC
            LIMIT 5
        `;
        const activityRes = await pool.query(activityQuery, [userId]);

        const recentActivity = activityRes.rows.map(row => ({
            id: row.id,
            type: row.type,
            item: row.item,
            customerEmail: row.customer_email,
            date: row.date,
            amount: row.amount,
            status: mapStatusToLabel(row.status)
        }));

        // 5. Onboarding Status
        const profileRes = await pool.query('SELECT is_verified, kyc_documents, rut, bank_data FROM provider_profiles WHERE user_id = $1', [userId]);
        const profile = profileRes.rows[0];

        // Valid Bank Details Check
        const hasBankData = profile && profile.bank_data && profile.bank_data.accountNumber && profile.bank_data.accountNumber.length > 0;

        const onboarding = {
            isVerified: profile ? profile.is_verified : false,
            hasServices: assetStats.activeServices > 0,
            hasKycDocs: profile && profile.kyc_documents && Object.keys(profile.kyc_documents).length > 0,
            hasBankDetails: hasBankData
        };

        res.json({
            status: 'success',
            stats: {
                income: incomeStats,
                assets: assetStats,
                reputation: reputationStats,
                onboarding // New field
            },
            recentActivity
        });

    } catch (err) {
        logger.error(`Dashboard Stats Error: ${err.message}`);
        next(err);
    }
};

// GET /api/provider/finance
export const getFinanceDetails = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // 1. Calculate KPIs from Bookings
        // Correct DB statuses: pending_payment, in_escrow, service_completed, released, disputed, cancelled
        // - in_escrow: Payment received, held in escrow
        // - service_completed: Work done, awaiting release
        // - released: Funds released to provider (completed transaction)
        await ensureBookingPricingColumns();
        const kpiQuery = `
            SELECT b.amount, b.base_amount, b.platform_fee, b.commission_rate, b.commission_type, b.fixed_commission,
                   b.status,
                   sc.commission_percentage as category_commission_percentage,
                   sc.commission_type as category_commission_type,
                   sc.fixed_commission as category_fixed_commission
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE b.provider_id = $1 AND b.status IN ('in_escrow', 'service_completed', 'released')
        `;
        const kpiRes = await pool.query(kpiQuery, [userId]);

        const totalIncome = kpiRes.rows.reduce((sum, row) => sum + (parseInt(row.amount, 10) || 0), 0);
        const commissionPaid = kpiRes.rows
            .filter(row => row.status === 'released')
            .reduce((sum, row) => sum + getBookingPricingFromRow(row).platformFee, 0);
        const availableBalance = kpiRes.rows
            .filter(row => ['in_escrow', 'service_completed'].includes(row.status))
            .reduce((sum, row) => {
                const pricing = getBookingPricingFromRow(row);
                return sum + Math.max(0, (parseInt(row.amount, 10) || 0) - pricing.platformFee);
            }, 0);

        // 2. Transactions (Recent Bookings with payments)
        const transactionsQuery = `
             SELECT 
                b.id,
                b.created_at as date,
                b.id as order_id,
                u.email as client_name,
                'service' as type,
                b.amount as total_amount,
                b.base_amount,
                b.platform_fee,
                b.commission_rate,
                b.commission_type,
                b.fixed_commission,
                b.status,
                sc.commission_percentage as category_commission_percentage,
                sc.commission_type as category_commission_type,
                sc.fixed_commission as category_fixed_commission
            FROM bookings b
            JOIN users u ON b.client_id = u.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE b.provider_id = $1 AND b.status IN ('in_escrow', 'service_completed', 'released')
            ORDER BY b.created_at DESC
            LIMIT 10
        `;
        const transactionsRes = await pool.query(transactionsQuery, [userId]);

        const transactions = transactionsRes.rows.map(row => ({
            id: row.id,
            date: row.date,
            orderId: row.order_id,
            clientName: row.client_name,
            type: row.type,
            totalAmount: row.total_amount,
            yourEarning: Math.max(0, (parseInt(row.total_amount, 10) || 0) - getBookingPricingFromRow(row).platformFee)
        }));

        // 3. Payouts (Mock for now as no Payouts table)
        const payouts = [];

        res.json({
            status: 'success',
            kpi: {
                availableBalance,
                totalIncome,
                commissionPaid,
                nextPayout: availableBalance > 0 ? availableBalance : 0
            },
            transactions,
            payouts
        });

    } catch (err) {
        logger.error(`Finance Details Error: ${err.message}`);
        next(err);
    }
};

// ADMIN: Get Full Provider Details (including KYC)
export const getProviderDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                u.id, 
                u.email, 
                u.role,
                pp.full_name,
                pp.store_name,
                pp.rut,
                pp.phone,
                pp.bio,
                pp.coverage_area,
                pp.is_verified,
                pp.kyc_documents,
                pp.profile_image_url
            FROM users u
            JOIN provider_profiles pp ON u.id = pp.user_id
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Provider not found' });
        }

        res.json({
            status: 'success',
            data: {
                ...result.rows[0],
                kyc_documents: normalizePrivateKycDocumentUrls(result.rows[0].kyc_documents)
            }
        });
    } catch (err) {
        next(err);
    }
};

// ADMIN: Get Provider Services
export const getProviderServices = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT * FROM services 
            WHERE provider_id = $1 
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [id]);

        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (err) {
        next(err);
    }
};

// ADMIN: Update Document Status
export const updateDocumentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { documentId, status, feedback } = req.body; // documentId = 'kyc_sii', status = 'approved'|'rejected'

        // 1. Fetch Profile
        const profileRes = await pool.query('SELECT user_id, kyc_documents, is_verified FROM provider_profiles WHERE user_id = $1', [id]);
        if (profileRes.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Provider not found' });

        const profile = profileRes.rows[0];
        const docs = profile.kyc_documents || {};

        if (!docs[documentId]) {
            return res.status(404).json({ status: 'error', message: 'Document not found' });
        }

        // 2. Update Specific Document
        docs[documentId].status = status;
        if (feedback) docs[documentId].feedback = feedback;
        docs[documentId].updatedAt = new Date().toISOString();

        // 3. Dynamic Verification Logic
        const mandatoryFields = await getMandatoryKycFieldIds();
        const shouldVerify = mandatoryFields.every(field => {
            const doc = docs[field];
            return doc && (doc.status === 'approved' || doc.status === 'Aprobado');
        });

        console.log(`[KYC Update] Provider: ${id}, Doc: ${documentId}, NewStatus: ${status}, ShouldVerify: ${shouldVerify}`);

        // 4. Update DB
        const updateQuery = `
            UPDATE provider_profiles 
            SET kyc_documents = $1, is_verified = $2
            WHERE user_id = $3
            RETURNING kyc_documents, is_verified
        `;

        const result = await pool.query(updateQuery, [JSON.stringify(docs), shouldVerify, id]);

        res.json({
            status: 'success',
            message: 'Document status updated',
            isVerified: shouldVerify,
            data: result.rows[0]
        });

    } catch (err) {
        next(err);
    }
};

// ADMIN: Toggle Payouts
export const togglePayouts = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body; // boolean

        // 0. (Lazy Migration) Ensure column exists
        // We do this here to avoid needing manual console access
        await pool.query(`
            ALTER TABLE provider_profiles 
            ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT TRUE
        `);

        // 1. Update
        const query = `
            UPDATE provider_profiles 
            SET payouts_enabled = $1 
            WHERE user_id = $2
            RETURNING payouts_enabled
        `;
        const result = await pool.query(query, [enabled, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Provider not found' });
        }

        res.json({
            status: 'success',
            message: `Payouts ${enabled ? 'enabled' : 'disabled'}`,
            payoutsEnabled: result.rows[0].payouts_enabled
        });
    } catch (err) {
        next(err);
    }
};





// DEBUG: Inspect Provider Raw Data
export const debugProvider = async (req, res, next) => {
    try {
        const { id } = req.params;
        const resDb = await pool.query('SELECT user_id, full_name, is_verified, kyc_documents, payouts_enabled FROM provider_profiles WHERE user_id = $1', [id]);

        const profile = resDb.rows[0];
        console.log(`[DEBUG PROVIDER ${id}]`, profile);

        res.json({
            status: 'debug',
            data: profile,
            analysis: {
                hasDocs: profile && profile.kyc_documents,
                docCount: profile && profile.kyc_documents ? Object.keys(profile.kyc_documents).length : 0,
                isVerifiedDB: profile ? profile.is_verified : 'N/A'
            }
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/providers (Public List)
export const getAllProviders = async (req, res, next) => {
    try {
        const query = `
            SELECT 
                u.id, 
                COALESCE(pp.store_name, pp.full_name) as name, 
                CASE WHEN pp.profile_image_status = 'approved' THEN pp.profile_image_url ELSE NULL END as image, 
                pp.coverage_area as location,
                pp.coverage_region_code,
                pp.coverage_region_name,
                pp.coverage_communes,
                pp.bio as tagline,
                pp.is_verified as verified,
                pp.payouts_enabled
            FROM users u
            JOIN provider_profiles pp ON u.id = pp.user_id
            WHERE u.role = 'provider' AND pp.is_verified = TRUE AND COALESCE(u.is_blocked, FALSE) = FALSE
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(query);

        // Map for frontend
        const providers = result.rows.map(row => {
            const coverage = getPublicCoverage({
                ...row,
                coverage_area: row.location
            });

            return {
                id: row.id,
                name: row.name,
                image: row.image || 'https://via.placeholder.com/150',
                location: coverage.location,
                coverage_region_code: coverage.coverage_region_code,
                coverage_region_name: coverage.coverage_region_name,
                coverage_communes: coverage.coverage_communes,
                coverage_area: coverage.coverage_area,
                rating: 5.0, // Mock
                reviews: 0, // Mock
                tagline: row.tagline ? row.tagline.substring(0, 60) + '...' : 'Proveedor de Servicios',
                verified: row.verified,
                status: 'Activo'
                // Financial settlement state is intentionally private.
            };
        });

        console.log("DEBUG: Providers List", providers.map(p => ({ id: p.id, name: p.name, verified: p.verified, status: p.status })));

        res.json({
            status: 'success',
            data: providers
        });
    } catch (err) {
        logger.error(`Get All Providers Error: ${err.message}`);
        next(err);
    }
};

// GET /api/providers/:id (Public)
export const getPublicProviderProfile = async (req, res, next) => {
    const { id } = req.params;
    if (!isValidUuid(id)) {
        return res.status(400).json({
            status: 'error',
            message: 'Identificador de proveedor invalido.',
            code: 'INVALID_PROVIDER_ID'
        });
    }
    let debugStep = 'start';

    try {
        debugStep = 'profile_query';
        // 1. Fetch Provider Profile
        const profileQuery = `
            SELECT 
                u.id,
                u.email,
                u.created_at as joined_date,
                pp.store_name, pp.full_name,
                pp.bio,
                CASE WHEN pp.profile_image_status = 'approved' THEN pp.profile_image_url ELSE NULL END as profile_image_url,
                CASE WHEN pp.banner_image_status = 'approved' THEN pp.banner_image_url ELSE NULL END as banner_image_url,
                pp.coverage_area as location,
                pp.coverage_region_code,
                pp.coverage_region_name,
                pp.coverage_communes,
                pp.is_verified
            FROM users u
            JOIN provider_profiles pp ON u.id = pp.user_id
            WHERE u.id = $1 AND u.role = 'provider' AND pp.is_verified = TRUE AND COALESCE(u.is_blocked, FALSE) = FALSE
        `;
        const profileRes = await pool.query(profileQuery, [id]);

        if (profileRes.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Proveedor no encontrado'
            });
        }

        const profile = profileRes.rows[0];
        const coverage = getPublicCoverage({
            ...profile,
            coverage_area: profile.location
        });

        debugStep = 'services_query';
        // 2. Fetch Services with their ratings
        const servicesQuery = `
            SELECT s.id, s.title, s.price, s.video_url, s.image_urls, s.cover_image_url, s.category,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM services s
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.provider_id = $1 AND s.is_active = true AND s.moderation_status = 'approved'
            GROUP BY s.id, s.title, s.price, s.video_url, s.image_urls, s.cover_image_url, s.category,
                     sc.commission_percentage, sc.commission_type, sc.fixed_commission
        `;
        const servicesRes = await pool.query(servicesQuery, [id]);

        debugStep = 'reviews_query';
        // 3. Fetch Reviews
        let reviewsRows = [];
        try {
            const reviewsRes = await pool.query(
                'SELECT id, reviewer_name, rating, comment, created_at FROM reviews WHERE provider_id = $1 ORDER BY created_at DESC',
                [id]
            );
            reviewsRows = reviewsRes.rows;
        } catch (revErr) {
            console.warn(`[PROVIDER WARNING] Failed to fetch reviews: ${revErr.message}`);
        }

        debugStep = 'stats_calc';
        // 4. Calculate Stats from REAL data
        const reviewCount = reviewsRows.length;
        const avgRating = reviewCount > 0
            ? (reviewsRows.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviewCount).toFixed(1)
            : null; // null = no reviews, frontend shows "Nuevo"

        // Calculate repeat hires (clients who booked more than once)
        const repeatHiresQuery = `
            SELECT 
                COUNT(DISTINCT client_id) as total_clients,
                COUNT(DISTINCT CASE WHEN client_bookings > 1 THEN client_id END) as repeat_clients
            FROM (
                SELECT client_id, COUNT(*) as client_bookings
                FROM bookings
                WHERE provider_id = $1 AND status IN ('completed', 'confirmed')
                GROUP BY client_id
            ) sub
        `;
        let repeatHiresPercent = null;
        try {
            const repeatRes = await pool.query(repeatHiresQuery, [id]);
            const totalClients = parseInt(repeatRes.rows[0].total_clients) || 0;
            const repeatClients = parseInt(repeatRes.rows[0].repeat_clients) || 0;
            if (totalClients > 0) {
                repeatHiresPercent = Math.round((repeatClients / totalClients) * 100) + '%';
            }
        } catch (e) {
            console.warn('[PROVIDER] Repeat hires calc failed:', e.message);
        }

        debugStep = 'jobs_count';
        const jobsCompleted = await getCompletedJobsCount(id);

        const stats = {
            jobsCompleted,
            repeatHires: repeatHiresPercent, // null if no data
            responseTime: '1 hora' // This could be calculated from message response times in future
        };

        debugStep = 'response_build';
        res.json({
            status: 'success',
            data: {
                id,
                name: getPublicProviderName(profile),
                tagline: profile.bio ? profile.bio.substring(0, 50) + '...' : 'Proveedor Verificado',
                location: coverage.location,
                coverage_region_code: coverage.coverage_region_code,
                coverage_region_name: coverage.coverage_region_name,
                coverage_communes: coverage.coverage_communes,
                coverage_area: coverage.coverage_area,
                joinedDate: profile.joined_date ? new Date(profile.joined_date).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) : 'Reciente',
                responseTime: '1 hora',
                rating: avgRating ? parseFloat(avgRating) : null,
                reviewsCount: reviewCount,
                verified: profile.is_verified || false,
                about: profile.bio || 'Sin descripción.',
                profile_image_url: profile.profile_image_url,
                banner_image_url: profile.banner_image_url,
                stats,
                services: (servicesRes.rows || []).map(s => ({
                    id: s.id,
                    title: s.title,
                    price: s.price,
                    // Commission rules are intentionally excluded from public responses.
                    // Checkout obtains customer-facing totals from the quote endpoint.
                    // No settlement configuration is exposed here.
                    location: coverage.location,
                    coverage_region_code: coverage.coverage_region_code,
                    coverage_region_name: coverage.coverage_region_name,
                    coverage_communes: coverage.coverage_communes,
                    coverage_area: coverage.coverage_area,
                    image: s.cover_image_url || s.image_urls?.[0] || null,
                    rating: s.review_count > 0 ? parseFloat(s.avg_rating).toFixed(1) : null
                })),
                reviews: (reviewsRows || []).map(r => ({
                    id: r.id,
                    user: r.reviewer_name || 'Anónimo',
                    rating: r.rating,
                    date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Reciente',
                    comment: r.comment
                }))
            }
        });

    } catch (err) {
        console.error(`[PROVIDER PROFILE ERROR] Step: ${debugStep}, Error: ${err.message}`);
        res.status(500).json({
            status: 'error',
            // Internal diagnostics remain in server logs only.
            message: 'No se pudo cargar el perfil del proveedor.',
            // No database or deployment details are returned publicly.
        });
    }
};

const getCompletedJobsCount = async (providerId) => {
    try {
        const res = await pool.query("SELECT COUNT(*) FROM bookings WHERE provider_id = $1 AND status = 'completed'", [providerId]);
        return parseInt(res.rows[0].count);
    } catch (e) {
        return 0;
    }
};
