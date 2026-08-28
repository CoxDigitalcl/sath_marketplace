import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import crypto from 'crypto';
import cacheService from '../services/cacheService.js';
import { parseCoverageCommunes } from '../../shared/chileLocations.js';
import { toPublicServiceDto } from '../utils/publicDtos.js';
import { isValidUuid } from '../utils/identifiers.js';
import {
    createServiceWithInitialRevision,
    recordServiceChanges,
    ServiceRevisionError,
} from '../services/serviceRevisionService.js';
import { ServiceChangePolicyError } from '../services/serviceChangePolicy.js';
import {
    createServiceRevisionSchema,
    formatServiceValidationError,
    updateServiceRevisionSchema,
} from '../utils/serviceRevisionValidation.js';
import { notifyAllAdmins } from './notificationController.js';


const PROMOTION_PAYMENT_STATUSES = new Set(['PAID', 'PENDING_DEDUCTION', 'PENDING', 'EXPIRED']);

const normalizePromotionKeywords = (keywords) => {
    const values = Array.isArray(keywords) ? keywords : [];
    return [...new Set(
        values
            .map((keyword) => String(keyword || '').trim())
            .filter(Boolean)
            .slice(0, 5)
    )].map((keyword) => keyword.slice(0, 60));
};

const clearPublicServiceCache = () => {
    try {
        cacheService.flush();
    } catch (err) {
        logger.warn(`Could not clear service cache after promotion change: ${err.message}`);
    }
};


// GET ACTIVE PROMOTION TIERS (Public for providers)
// GET /api/services/promotion-tiers
export const getActivePromotionTiers = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT id, name, duration_days, price_clp, description, display_order
            FROM promotion_tiers
            WHERE is_active = TRUE
            ORDER BY display_order ASC
        `);

        res.json({
            status: 'success',
            tiers: result.rows
        });
    } catch (err) {
        logger.error(`Get Active Promotion Tiers Error: ${err.message}`);
        next(err);
    }
};

// CREATE PROMOTION
// POST /api/services/promotions
export const createPromotion = async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Accept both camelCase and snake_case from frontend
        const serviceId = req.body.service_id || req.body.serviceId;
        const tierId = req.body.tier_id || req.body.tierId;
        const paymentMethod = req.body.payment_method || 'deduct';
        const keywords = normalizePromotionKeywords(req.body.keywords || []);

        logger.info(`[createPromotion] Parsed: serviceId=${serviceId}, tierId=${tierId}, paymentMethod=${paymentMethod}`);

        if (!serviceId) {
            return res.status(400).json({ status: 'error', message: 'service_id es requerido' });
        }

        if (!tierId) {
            logger.warn('[createPromotion] tierId is missing.', { userId, correlationId: req.correlationId });
            return res.status(400).json({ status: 'error', message: 'Debes seleccionar un plan de promoción' });
        }

        if (!['now', 'deduct'].includes(paymentMethod)) {
            return res.status(400).json({ status: 'error', message: 'Metodo de pago no valido' });
        }

        if (keywords.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Debes agregar al menos una palabra clave' });
        }

        // Fetch tier details
        const tierResult = await pool.query(
            'SELECT duration_days, price_clp, payment_url FROM promotion_tiers WHERE id = $1 AND is_active = TRUE',
            [tierId]
        );

        if (tierResult.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Plan de promoción no disponible' });
        }

        const { duration_days, price_clp, payment_url } = tierResult.rows[0];
        if (Number(duration_days) <= 0 || Number(price_clp) <= 0) {
            return res.status(400).json({ status: 'error', message: 'El plan de promocion no tiene precio o duracion validos' });
        }

        if (paymentMethod === 'now' && !payment_url) {
            return res.status(400).json({
                status: 'error',
                message: 'Este plan no tiene link de pago configurado. Solicita cobro diferido o contacta al administrador.'
            });
        }

        // Verify ownership
        const serviceCheck = await pool.query('SELECT provider_id, is_active, moderation_status FROM services WHERE id = $1', [serviceId]);
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Servicio no encontrado' });
        }
        if (serviceCheck.rows[0].provider_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'No autorizado para promocionar este servicio' });
        }
        if (!serviceCheck.rows[0].is_active || serviceCheck.rows[0].moderation_status !== 'approved') {
            return res.status(400).json({ status: 'error', message: 'Solo puedes promocionar servicios activos' });
        }

        const existingPromotion = await pool.query(`
            SELECT id, payment_status
            FROM featured_promotions
            WHERE service_id = $1
              AND payment_status IN ('PAID', 'PENDING', 'PENDING_DEDUCTION')
              AND end_date > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        `, [serviceId]);

        if (existingPromotion.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Este servicio ya tiene una promocion activa o pendiente.'
            });
        }

        // Generate UUID v4 for the promotion
        const promotionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

        // Determine payment status based on method
        const paymentStatus = paymentMethod === 'now' ? 'PENDING' : 'PENDING_DEDUCTION';

        const query = `
            INSERT INTO featured_promotions (
                id, service_id, tier_id, start_date, end_date, payment_status, target_keywords, amount
            )
            VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval, $5, $6::jsonb, $7)
            RETURNING *
        `;

        const keywordsJson = JSON.stringify(keywords);

        const result = await pool.query(query, [promotionId, serviceId, tierId, duration_days, paymentStatus, keywordsJson, price_clp]);

        logger.info(`Promotion created for service ${serviceId} by user ${userId}, tier: ${tierId}`);
        clearPublicServiceCache();

        res.status(201).json({
            status: 'success',
            message: paymentMethod === 'now'
                ? 'Promocion creada. Completa el pago para activarla.'
                : 'Solicitud de promocion registrada. Se activara cuando el administrador confirme el cobro.',
            promotion: result.rows[0],
            paymentUrl: paymentMethod === 'now' ? payment_url : null
        });

    } catch (err) {
        logger.error(`Create Promotion Error: ${err.message}`);
        next(err);
    }
};

// CREATE SERVICE
// POST /api/services
export const createService = async (req, res, next) => {
    const parsed = createServiceRevisionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(formatServiceValidationError(parsed.error));
    }

    try {
        const result = await createServiceWithInitialRevision({
            providerId: req.user.id,
            proposedChanges: parsed.data,
        });
        void notifyAllAdmins({
            title: 'Nuevo Servicio por revisar',
            message: `“${parsed.data.title}” requiere una revisión completa.`,
            type: 'warning',
        });

        return res.status(201).json({
            status: 'success',
            message: 'Servicio creado y enviado a revisión completa.',
            outcome: result.outcome,
            appliedFields: result.appliedFields,
            review: reviewSummaryFromRevision(result.revision),
            service: result.service,
        });
    } catch (err) {
        if (respondWithServiceRevisionError(res, err)) return;
        logger.error(`Create Service Error: ${err.message}`);
        next(err);
    }
};

// UPDATE SERVICE
// PUT /api/services/:id
// UPDATE SERVICE
// PUT /api/services/:id
export const updateService = async (req, res, next) => {
    const parsed = updateServiceRevisionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(formatServiceValidationError(parsed.error));
    }

    try {
        const { expected_revision_id: expectedRevisionId, ...proposedChanges } = parsed.data;
        const result = await recordServiceChanges({
            serviceId: req.params.id,
            providerId: req.user.id,
            proposedChanges,
            expectedRevisionId,
        });

        if (result.appliedFields.length > 0) clearPublicServiceCache();
        if (result.revision?.status === 'pending') {
            void notifyAllAdmins({
                title: 'Cambios de Servicio por revisar',
                message: `“${result.service.title}” tiene cambios que requieren moderación.`,
                type: 'warning',
            });
        }

        const messages = {
            applied: 'Los cambios seguros se aplicaron inmediatamente.',
            review_required: 'Los cambios quedaron pendientes de revisión.',
            mixed: 'Los cambios seguros se aplicaron y el resto quedó pendiente de revisión.',
            no_changes: 'No había cambios nuevos para guardar.',
        };
        return res.json({
            status: 'success',
            message: messages[result.outcome],
            outcome: result.outcome,
            appliedFields: result.appliedFields,
            review: reviewSummaryFromRevision(result.revision),
            service: result.service,
        });
    } catch (err) {
        if (respondWithServiceRevisionError(res, err)) return;
        logger.error(`Update Service Error: ${err.message}`);
        next(err);
    }
};

const respondWithServiceRevisionError = (res, error) => {
    if (!(error instanceof ServiceRevisionError) && !(error instanceof ServiceChangePolicyError)) return false;
    res.status(error.statusCode || 400).json({
        status: 'error',
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
    });
    return true;
};

const reviewSummaryFromRevision = (revision) => {
    if (!revision || !['pending', 'correction_requested', 'rejected'].includes(revision.status)) return null;
    return {
        revisionId: revision.id,
        status: revision.status === 'correction_requested' ? 'changes_requested' : revision.status,
        scope: revision.reviewScope === 'full' ? 'full' : 'targeted',
        changedFields: revision.pendingFields || [],
        reasons: (revision.reviewReasons || [])
            .map((reason) => typeof reason === 'string' ? reason : reason?.code)
            .filter(Boolean),
    };
};


// UPDATE SERVICE PUBLICATION STATUS
// PATCH /api/services/:id/status
export const updateServicePublicationStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isActive = req.body?.is_active;

        if (!isValidUuid(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Identificador de servicio invalido.',
                code: 'INVALID_SERVICE_ID'
            });
        }
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                status: 'error',
                message: 'El estado activo del servicio debe ser verdadero o falso.',
                code: 'INVALID_SERVICE_STATUS'
            });
        }

        const serviceCheck = await pool.query(
            'SELECT provider_id, moderation_status, is_active FROM services WHERE id = $1',
            [id]
        );
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Servicio no encontrado.',
                code: 'SERVICE_NOT_FOUND'
            });
        }

        const service = serviceCheck.rows[0];
        if (service.provider_id !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para cambiar el estado de este servicio.',
                code: 'SERVICE_STATUS_FORBIDDEN'
            });
        }
        if (service.moderation_status !== 'approved') {
            return res.status(409).json({
                status: 'error',
                message: 'El servicio debe estar aprobado por un administrador antes de poder activarlo o pausarlo.',
                code: 'SERVICE_NOT_APPROVED'
            });
        }

        const result = await pool.query(
            `UPDATE services
             SET is_active = $1,
                 updated_at = NOW()
             WHERE id = $2
               AND provider_id = $3
               AND moderation_status = 'approved'
             RETURNING id, is_active, moderation_status, updated_at`,
            [isActive, id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({
                status: 'error',
                message: 'El estado de moderacion cambio durante la operacion. Recarga la lista e intenta nuevamente.',
                code: 'SERVICE_STATUS_CONFLICT'
            });
        }

        clearPublicServiceCache();
        return res.json({
            status: 'success',
            message: isActive ? 'Servicio activado.' : 'Servicio pausado.',
            service: result.rows[0]
        });
    } catch (err) {
        logger.error(`Update Service Publication Status Error: ${err.message}`);
        next(err);
    }
};


// GET FEATURED SERVICES
// GET /api/services/featured
export const getFeaturedServices = async (req, res, next) => {
    try {
        const responseData = {
            sponsored: [],
            bestSellers: [],
            staffPicks: [],
            newArrivals: []
        };

        // 1. Sponsored (Promocionados) - with rating from reviews
        const sponsoredQuery = `
            SELECT s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                   p.full_name as provider_name, p.coverage_area as location,
                   p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                   sp.payment_status,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM services s
            JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
            JOIN featured_promotions sp ON s.id = sp.service_id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true AND s.moderation_status = 'approved'
              AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
              AND sp.payment_status = 'PAID'
              AND sp.end_date > NOW()
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sp.payment_status, sc.commission_percentage, sc.commission_type, sc.fixed_commission
            ORDER BY RANDOM()
            LIMIT 8
        `;
        const sponsoredRes = await pool.query(sponsoredQuery);
        responseData.sponsored = sponsoredRes.rows.map(row => toPublicServiceDto({
            ...row,
            isSponsored: true,
            rating: row.review_count > 0 ? parseFloat(row.avg_rating).toFixed(1) : null
        }));

        // 2. Best Sellers - with rating
        const bestSellersQuery = `
            SELECT s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                   p.full_name as provider_name, p.coverage_area as location,
                   p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission,
                   COUNT(DISTINCT b.id) as sales_count,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(DISTINCT r.id) as review_count
            FROM services s
            JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN bookings b ON s.id = b.service_id AND b.status IN ('completed', 'confirmed')
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true AND s.moderation_status = 'approved' AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sc.commission_percentage, sc.commission_type, sc.fixed_commission
            ORDER BY sales_count DESC
            LIMIT 8
        `;
        const bestSellersRes = await pool.query(bestSellersQuery);
        responseData.bestSellers = bestSellersRes.rows.map(row => toPublicServiceDto({
            ...row,
            isSponsored: false,
            rating: row.review_count > 0 ? parseFloat(row.avg_rating).toFixed(1) : null
        }));

        // 3. Staff Picks - with rating
        const staffPicksQuery = `
            SELECT s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                   p.full_name as provider_name, p.coverage_area as location,
                   p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM services s
            JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true AND s.moderation_status = 'approved'
              AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
              AND s.is_staff_pick = true
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sc.commission_percentage, sc.commission_type, sc.fixed_commission
            LIMIT 8
        `;
        const staffPicksRes = await pool.query(staffPicksQuery);
        responseData.staffPicks = staffPicksRes.rows.map(row => toPublicServiceDto({
            ...row,
            isSponsored: false,
            rating: row.review_count > 0 ? parseFloat(row.avg_rating).toFixed(1) : null
        }));

        // 4. New Arrivals - with rating
        let newArrivalsQuery = `
            SELECT s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active, s.created_at,
                   p.full_name as provider_name, p.coverage_area as location,
                   p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM services s
            JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true AND s.moderation_status = 'approved'
              AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
              AND s.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active, s.created_at,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sc.commission_percentage, sc.commission_type, sc.fixed_commission
            ORDER BY s.created_at DESC
            LIMIT 8
        `;
        let newArrivalsRes = await pool.query(newArrivalsQuery);

        if (newArrivalsRes.rows.length === 0) {
            newArrivalsQuery = `
                SELECT s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active, s.created_at,
                       p.full_name as provider_name, p.coverage_area as location,
                       p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                       COALESCE(sc.commission_percentage, 10) as commission_percentage,
                       COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                       COALESCE(sc.fixed_commission, 0) as fixed_commission,
                       COALESCE(AVG(r.rating), 0) as avg_rating,
                       COUNT(r.id) as review_count
                FROM services s
                JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
                LEFT JOIN service_categories sc ON s.category = sc.id
                LEFT JOIN reviews r ON s.id = r.service_id
                WHERE s.is_active = true AND s.moderation_status = 'approved' AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
                GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active, s.created_at,
                         p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                         sc.commission_percentage, sc.commission_type, sc.fixed_commission
                ORDER BY s.created_at DESC
                LIMIT 8
            `;
            newArrivalsRes = await pool.query(newArrivalsQuery);
        }
        responseData.newArrivals = newArrivalsRes.rows.map(row => toPublicServiceDto({
            ...row,
            isSponsored: false,
            rating: row.review_count > 0 ? parseFloat(row.avg_rating).toFixed(1) : null
        }));

        res.json({
            status: 'success',
            data: responseData
        });

    } catch (err) {
        logger.error(`Get Featured Services Error: ${err.message}`);
        next(err);
    }
};

// GET ALL SERVICES (SEARCH)
// GET /api/services?category=...&q=...&region=...&commune=...
export const getServices = async (req, res, next) => {
    try {
        const { category, q, region, commune, page = '1', limit = '50' } = req.query;
        const regionFilter = String(region || '').trim().toUpperCase();
        const communeFilters = [...new Set(parseCoverageCommunes(commune))];
        const categoryFilter = String(category || '').trim();
        const searchFilter = String(q || '').trim();
        const pageNumber = Number(page);
        const pageSize = Number(limit);

        const invalidQuery = (
            categoryFilter.length > 100 ||
            searchFilter.length > 100 ||
            regionFilter.length > 10 ||
            communeFilters.length > 20 ||
            !/^\d+$/.test(String(page)) ||
            !/^\d+$/.test(String(limit)) ||
            !Number.isSafeInteger(pageNumber) ||
            !Number.isSafeInteger(pageSize) ||
            pageNumber < 1 ||
            pageSize < 1 ||
            pageSize > 100
        );
        if (invalidQuery) {
            return res.status(400).json({
                status: 'error',
                message: 'Los parametros de busqueda no son validos.',
                code: 'INVALID_SERVICE_QUERY'
            });
        }

        // Use only paid and active promotions. Pending rows must not shadow a valid paid promotion.
        let query = `
            SELECT s.*, p.full_name as provider_name, p.coverage_area as location,
                   p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                   review_stats.avg_rating, review_stats.review_count,
                   lp.payment_status, lp.start_date as promotion_start_date,
                   lp.target_keywords,
                   (lp.payment_status = 'PAID') as is_sponsored,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission
            FROM services s 
            JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN LATERAL (
                SELECT AVG(r.rating)::numeric AS avg_rating, COUNT(r.id)::integer AS review_count
                FROM reviews r
                WHERE r.service_id = s.id
            ) review_stats ON true
            LEFT JOIN LATERAL (
                SELECT sp.payment_status, sp.start_date, sp.end_date, sp.target_keywords
                FROM featured_promotions sp 
                WHERE sp.service_id = s.id
                  AND sp.payment_status = 'PAID'
                  AND sp.end_date > NOW()
                ORDER BY sp.start_date ASC
                LIMIT 1
            ) lp ON true
            WHERE s.is_active = true AND s.moderation_status = 'approved' AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
        `;

        const params = [];
        let whereConditions = [];

        if (categoryFilter) {
            params.push(categoryFilter);
            whereConditions.push(`s.category = $${params.length}`);
        }

        if (searchFilter) {
            params.push(`%${searchFilter}%`);
            whereConditions.push(`(
                s.title ILIKE $${params.length} 
                OR s.description ILIKE $${params.length}
                OR s.category ILIKE $${params.length}
                OR s.categories_json::text ILIKE $${params.length}
                OR (
                    lp.payment_status = 'PAID' AND 
                    lp.target_keywords::text ILIKE $${params.length}
                )
            )`);
        }

        if (regionFilter) {
            params.push(regionFilter);
            whereConditions.push(`(s.type = 'online' OR p.coverage_region_code = $${params.length})`);
        }

        if (communeFilters.length > 0) {
            params.push(communeFilters);
            whereConditions.push(`(s.type = 'online' OR p.coverage_communes ?| $${params.length}::text[])`);
        }

        if (whereConditions.length > 0) {
            query += ' AND ' + whereConditions.join(' AND ');
        }

        // Custom Ordering for Search:
        // 1. Active Sponsored matching query (Oldest promotion start date first)
        // 2. Normal ordering (Newest services first)
        if (searchFilter) {
            query += `
                ORDER BY 
                CASE WHEN lp.payment_status = 'PAID' THEN 0 ELSE 1 END,
                lp.start_date ASC, 
                s.created_at DESC
            `;
        } else {
            query += ' ORDER BY s.created_at DESC';
        }

        const offset = (pageNumber - 1) * pageSize;
        params.push(pageSize, offset);
        query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await pool.query(query, params);

        res.json({
            status: 'success',
            count: result.rows.length,
            services: result.rows.map(row => toPublicServiceDto({
                ...row,
                isSponsored: !!row.is_sponsored,
                rating: Number(row.review_count) > 0
                    ? Number(Number(row.avg_rating).toFixed(1))
                    : null
            })),
            pagination: {
                page: pageNumber,
                limit: pageSize,
                hasMore: result.rows.length === pageSize
            }
        });
    } catch (err) {
        next(err);
    }
};

// GET SERVICE BY ID
// GET /api/services/:id
export const getServiceById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!isValidUuid(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Identificador de servicio invalido.',
                code: 'INVALID_SERVICE_ID'
            });
        }
        const query = `
            SELECT s.*, 
                   p.full_name as provider_name, 
                   p.rut, 
                   p.coverage_area,
                   p.coverage_area as location,
                   p.coverage_region_code,
                   p.coverage_region_name,
                   p.coverage_communes,
                   p.profile_image_url as provider_image,
                   p.user_id as provider_id,
                   review_stats.avg_rating,
                   review_stats.review_count,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission
            FROM services s 
            JOIN provider_profiles p ON s.provider_id = p.user_id JOIN users u ON s.provider_id = u.id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN LATERAL (
                SELECT AVG(r.rating)::numeric AS avg_rating, COUNT(r.id)::integer AS review_count
                FROM reviews r
                WHERE r.service_id = s.id
            ) review_stats ON true
            WHERE s.id = $1 AND s.is_active = true AND s.moderation_status = 'approved' AND p.is_verified = true AND COALESCE(u.is_blocked, false) = false
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }

        res.json({
            status: 'success',
            service: toPublicServiceDto({
                ...result.rows[0],
                rating: Number(result.rows[0].review_count) > 0
                    ? Number(Number(result.rows[0].avg_rating).toFixed(1))
                    : null
            })
        });
    } catch (err) {
        next(err);
    }
};

// GET PROVIDER SERVICES (MY SERVICES)
// GET /api/services/my-services
export const getMyServices = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Use LEFT JOIN to ensure services are returned even if profile link status is quirky
        const query = `
            SELECT s.*, p.full_name as provider_name,
                   latest_revision.id AS change_revision_id,
                   latest_revision.status AS change_revision_status,
                   latest_revision.review_scope AS change_review_scope,
                   latest_revision.pending_fields AS change_pending_fields,
                   latest_revision.review_reasons AS change_review_reasons,
                   latest_revision.proposed_snapshot AS change_proposed_snapshot,
                   latest_decision.reason_code AS change_reason_code,
                   latest_decision.comment AS change_reason_comment
            FROM services s
            LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
            LEFT JOIN LATERAL (
                SELECT sr.*
                FROM service_revisions sr
                WHERE sr.service_id = s.id
                ORDER BY sr.revision_number DESC
                LIMIT 1
            ) latest_revision ON TRUE
            LEFT JOIN LATERAL (
                SELECT srd.reason_code, srd.comment
                FROM service_revision_decisions srd
                WHERE srd.revision_id = latest_revision.id
                ORDER BY srd.created_at DESC
                LIMIT 1
            ) latest_decision ON TRUE
            WHERE s.provider_id = $1
            ORDER BY s.created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const services = result.rows.map(row => {
            const reviewStatus = ['pending', 'correction_requested', 'rejected'].includes(row.change_revision_status)
                ? row.change_revision_status
                : null;
            const proposedSnapshot = reviewStatus && row.change_proposed_snapshot && typeof row.change_proposed_snapshot === 'object'
                ? row.change_proposed_snapshot
                : {};
            const providerServiceRow = Object.fromEntries(
                Object.entries(row).filter(([field]) => !field.startsWith('change_'))
            );
            const effectiveRow = { ...providerServiceRow, ...proposedSnapshot };
            const reviewReasons = Array.isArray(row.change_review_reasons)
                ? row.change_review_reasons
                    .map((reason) => typeof reason === 'string' ? reason : reason?.code)
                    .filter(Boolean)
                : [];

            return {
                ...effectiveRow,
                id: String(row.id),
                name: effectiveRow.title,
                price_clp: effectiveRow.price,
                iva_clp: Math.round(effectiveRow.price * 0.19),
                status: row.moderation_status === 'pending'
                    ? 'draft'
                    : row.moderation_status === 'rejected'
                        ? 'flagged'
                        : (row.is_active ? 'active' : 'paused'),
                videoUrl: effectiveRow.video_url,
                coverImageUrl: effectiveRow.cover_image_url || '',
                galleryMedia: effectiveRow.gallery_media || [],
                duration_minutes: effectiveRow.duration_minutes || 60,
                type: effectiveRow.type || 'online',
                availability_type: effectiveRow.availability_type || 'agenda',
                features: effectiveRow.features || [],
                imageUrls: effectiveRow.image_urls || [],
                calendar_config: effectiveRow.calendar_config || {},
                pricing_type: effectiveRow.pricing_type || 'per_event',
                categories: (effectiveRow.categories_json && effectiveRow.categories_json.length > 0)
                    ? effectiveRow.categories_json
                    : [{ categoryId: effectiveRow.category, subcategory: effectiveRow.subcategory || effectiveRow.category }],
                review: reviewStatus ? {
                    revisionId: row.change_revision_id,
                    status: reviewStatus === 'correction_requested' ? 'changes_requested' : reviewStatus,
                    scope: row.change_review_scope === 'full' ? 'full' : 'targeted',
                    changedFields: row.change_pending_fields || [],
                    reasons: reviewReasons,
                    reason: row.change_reason_comment || row.change_reason_code || undefined,
                } : null,
                requires_kyc: false
            };
        });

        res.json({
            status: 'success',
            services: services
        });
    } catch (err) {
        next(err);
    }
};

// TOGGLE STAFF PICK (ADMIN)
// PATCH /api/admin/services/:id/staff-pick
export const toggleStaffPick = async (req, res, next) => {
    try {
        const { id } = req.params;

        const query = `
            UPDATE services
            SET is_staff_pick = NOT COALESCE(is_staff_pick, false), updated_at = NOW()
            WHERE id = $1
            RETURNING id, is_staff_pick
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Service not found' });

        res.json({ status: 'success', service: result.rows[0] });
    } catch (err) {
        logger.error(`Toggle Staff Pick Error: ${err.message}`);
        next(err);
    }
};

// GET ADMIN PROMOTIONS
// GET /api/admin/promotions
export const getAdminPromotions = async (req, res, next) => {
    try {
        const query = `
            SELECT sp.*, s.title as service_name, p.full_name as provider_name,
                   pt.name as tier_name, pt.duration_days
            FROM featured_promotions sp
            JOIN services s ON sp.service_id = s.id
            JOIN provider_profiles p ON s.provider_id = p.user_id
            LEFT JOIN promotion_tiers pt ON sp.tier_id = pt.id
            ORDER BY sp.created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ status: 'success', promotions: result.rows });
    } catch (err) {
        logger.error(`Get Admin Promotions Error: ${err.message}`);
        next(err);
    }
};

// DELETE PROMOTION (ADMIN)
// DELETE /api/admin/promotions/:id
export const deletePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM featured_promotions WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Promoción no encontrada' });
        }

        logger.info(`Promotion deleted by admin: ${id}`);
        clearPublicServiceCache();
        res.json({ status: 'success', message: 'Promoción eliminada' });
    } catch (err) {
        logger.error(`Delete Promotion Error: ${err.message}`);
        next(err);
    }
};

// UPDATE PROMOTION STATUS (ADMIN)
// PUT /api/admin/promotions/:id
export const updatePromotionStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        if (!PROMOTION_PAYMENT_STATUSES.has(payment_status)) {
            return res.status(400).json({ status: 'error', message: 'Estado de promocion no valido' });
        }

        const currentPromotion = await pool.query(`
            SELECT sp.*, pt.duration_days
            FROM featured_promotions sp
            LEFT JOIN promotion_tiers pt ON sp.tier_id = pt.id
            WHERE sp.id = $1
        `, [id]);

        if (currentPromotion.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Promocion no encontrada' });
        }

        const promotion = currentPromotion.rows[0];
        const fallbackDurationMs = new Date(promotion.end_date).getTime() - new Date(promotion.start_date).getTime();
        const fallbackDurationDays = Math.max(1, Math.ceil(fallbackDurationMs / 86400000) || 1);
        const durationDays = Number(promotion.duration_days) > 0 ? Number(promotion.duration_days) : fallbackDurationDays;

        let result;
        if (payment_status === 'PAID') {
            result = await pool.query(`
                UPDATE featured_promotions
                SET payment_status = $1,
                    start_date = CASE WHEN payment_status = 'PAID' THEN start_date ELSE NOW() END,
                    end_date = CASE WHEN payment_status = 'PAID' THEN end_date ELSE NOW() + ($3 || ' days')::interval END,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [payment_status, id, durationDays]);
        } else if (payment_status === 'EXPIRED') {
            result = await pool.query(`
                UPDATE featured_promotions
                SET payment_status = $1,
                    end_date = LEAST(end_date, NOW()),
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [payment_status, id]);
        } else {
            result = await pool.query(
                'UPDATE featured_promotions SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                [payment_status, id]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Promoción no encontrada' });
        }

        logger.info(`Promotion status updated by admin: ${id} -> ${payment_status}`);
        clearPublicServiceCache();
        res.json({ status: 'success', message: 'Estado actualizado', promotion: result.rows[0] });
    } catch (err) {
        logger.error(`Update Promotion Status Error: ${err.message}`);
        next(err);
    }
};

// GET ALL SERVICES FOR ADMIN
// GET /api/admin/services
export const getAdminServices = async (req, res, next) => {
    try {
        const query = `
            SELECT s.*, p.full_name as provider_name
            FROM services s
            LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
            ORDER BY s.created_at DESC
        `;
        const result = await pool.query(query);

        // Map to match the Service type expected by the frontend
        const services = result.rows.map(row => ({
            ...row,
            id: String(row.id),
            name: row.title,
            price_clp: row.price,
            coverImageUrl: row.cover_image_url || '',
            imageUrls: row.image_urls || [],
            // Ensure provider object exists for the table display
            provider: {
                name: row.provider_name
            }
        }));

        res.json({
            status: 'success',
            count: services.length,
            services: services
        });
    } catch (err) {
        logger.error(`Get Admin Services Error: ${err.message}`);
        next(err);
    }
};

// PATCH /api/admin/services/:id/moderation
export const moderateService = async (_req, res, _next) => {
    return res.status(410).json({
        status: 'error',
        code: 'SERVICE_MODERATION_MOVED',
        message: 'La moderación directa fue deshabilitada. Revisa el detalle de cambios antes de decidir.',
    });
};
