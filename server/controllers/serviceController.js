import { pool } from '../config/db.js';
import logger from '../config/logger.js';
import crypto from 'crypto';
import cacheService from '../services/cacheService.js';
import { parseCoverageCommunes } from '../../shared/chileLocations.js';


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
            logger.warn(`[createPromotion] tierId is missing! Body was: ${JSON.stringify(req.body)}`);
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
        const serviceCheck = await pool.query('SELECT provider_id, is_active FROM services WHERE id = $1', [serviceId]);
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Servicio no encontrado' });
        }
        if (serviceCheck.rows[0].provider_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'No autorizado para promocionar este servicio' });
        }
        if (!serviceCheck.rows[0].is_active) {
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
    try {
        const userId = req.user.id; // From Auth Token
        const { title, description, category, price, video_url, cover_image_url } = req.body;

        if (!title || price === undefined || price === null || price === '' || !category) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const query = `
            INSERT INTO services (
                provider_id, title, description, category, price, video_url, is_active, 
                duration_minutes, type, availability_type, calendar_config, features, image_urls, categories_json, cover_image_url, gallery_media, pricing_type,
                freight_base_price, freight_price_per_km
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `;

        // Default values for new fields if not provided
        const {
            duration_minutes = 60,
            type = 'online',
            availability_type = 'agenda',
            calendar_config = {},
            features = [],
            image_urls = [],
            categories_json = [],
            gallery_media = [],
            pricing_type = 'per_event',
            freight_base_price = null,
            freight_price_per_km = null
        } = req.body;

        const toJson = (val) => JSON.stringify(val);

        const result = await pool.query(query, [
            userId, title, description, category, price, video_url,
            duration_minutes, type, availability_type, toJson(calendar_config), toJson(features), toJson(image_urls), toJson(categories_json),
            cover_image_url || null, toJson(gallery_media), pricing_type,
            freight_base_price, freight_price_per_km
        ]);

        res.status(201).json({
            status: 'success',
            message: 'Service created successfully',
            service: result.rows[0]
        });

    } catch (err) {
        logger.error(`Create Service Error: ${err.message}`);
        next(err);
    }
};

// UPDATE SERVICE
// PUT /api/services/:id
// UPDATE SERVICE
// PUT /api/services/:id
export const updateService = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const {
            title, description, category, price, video_url, is_active,
            duration_minutes, type, availability_type, calendar_config, features, image_urls, categories_json, cover_image_url, gallery_media, pricing_type,
            freight_base_price, freight_price_per_km
        } = req.body;

        // Helper to ensure valid JSON string for Postgres
        const toJson = (val) => (val !== undefined) ? JSON.stringify(val) : null;

        // 1. Verify ownership
        const serviceCheck = await pool.query('SELECT provider_id FROM services WHERE id = $1', [id]);
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }
        if (serviceCheck.rows[0].provider_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'Not authorized to update this service' });
        }

        // 2. Update
        const query = `
            UPDATE services 
            SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                category = COALESCE($3, category),
                price = COALESCE($4, price),
                video_url = COALESCE($5, video_url),
                is_active = COALESCE($6, is_active),
                duration_minutes = COALESCE($7, duration_minutes),
                type = COALESCE($8, type),
                availability_type = COALESCE($9, availability_type),
                calendar_config = COALESCE($10, calendar_config),
                features = COALESCE($11, features),
                image_urls = COALESCE($12, image_urls),
                categories_json = COALESCE($13, categories_json),
                cover_image_url = COALESCE($14, cover_image_url),
                gallery_media = COALESCE($15, gallery_media),
                pricing_type = COALESCE($16, pricing_type),
                freight_base_price = COALESCE($17, freight_base_price),
                freight_price_per_km = COALESCE($18, freight_price_per_km),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $19
            RETURNING *
        `;

        const result = await pool.query(query, [
            title,
            description,
            category,
            price,
            video_url,
            is_active,
            duration_minutes,
            type,
            availability_type,
            toJson(calendar_config),
            toJson(features),
            toJson(image_urls),
            toJson(categories_json),
            cover_image_url !== undefined ? cover_image_url : null,
            gallery_media !== undefined ? toJson(gallery_media) : null,
            pricing_type !== undefined ? pricing_type : null,
            freight_base_price !== undefined ? freight_base_price : null,
            freight_price_per_km !== undefined ? freight_price_per_km : null,
            id
        ]);

        res.json({
            status: 'success',
            message: 'Service updated successfully',
            service: result.rows[0]
        });

    } catch (err) {
        logger.error(`Update Service Error: ${err.message}`);
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
            JOIN provider_profiles p ON s.provider_id = p.user_id
            JOIN featured_promotions sp ON s.id = sp.service_id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true 
              AND p.is_verified = true
              AND sp.payment_status = 'PAID'
              AND sp.end_date > NOW()
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sp.payment_status, sc.commission_percentage, sc.commission_type, sc.fixed_commission
            ORDER BY RANDOM()
            LIMIT 8
        `;
        const sponsoredRes = await pool.query(sponsoredQuery);
        responseData.sponsored = sponsoredRes.rows.map(row => ({
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
            JOIN provider_profiles p ON s.provider_id = p.user_id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN bookings b ON s.id = b.service_id AND b.status IN ('completed', 'confirmed')
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true AND p.is_verified = true
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sc.commission_percentage, sc.commission_type, sc.fixed_commission
            ORDER BY sales_count DESC
            LIMIT 8
        `;
        const bestSellersRes = await pool.query(bestSellersQuery);
        responseData.bestSellers = bestSellersRes.rows.map(row => ({
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
            JOIN provider_profiles p ON s.provider_id = p.user_id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true 
              AND p.is_verified = true
              AND s.is_staff_pick = true
            GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active,
                     p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                     sc.commission_percentage, sc.commission_type, sc.fixed_commission
            LIMIT 8
        `;
        const staffPicksRes = await pool.query(staffPicksQuery);
        responseData.staffPicks = staffPicksRes.rows.map(row => ({
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
            JOIN provider_profiles p ON s.provider_id = p.user_id
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true 
              AND p.is_verified = true
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
                JOIN provider_profiles p ON s.provider_id = p.user_id
                LEFT JOIN service_categories sc ON s.category = sc.id
                LEFT JOIN reviews r ON s.id = r.service_id
                WHERE s.is_active = true AND p.is_verified = true
                GROUP BY s.id, s.title, s.description, s.price, s.image_urls, s.video_url, s.is_active, s.created_at,
                         p.full_name, p.coverage_area, p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                         sc.commission_percentage, sc.commission_type, sc.fixed_commission
                ORDER BY s.created_at DESC
                LIMIT 8
            `;
            newArrivalsRes = await pool.query(newArrivalsQuery);
        }
        responseData.newArrivals = newArrivalsRes.rows.map(row => ({
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
        const { category, q, region, commune } = req.query;
        const regionFilter = String(region || '').trim().toUpperCase();
        const communeFilters = [...new Set(parseCoverageCommunes(commune))];

        // Use only paid and active promotions. Pending rows must not shadow a valid paid promotion.
        let query = `
            SELECT s.*, p.full_name as provider_name, p.coverage_area as location,
                   p.coverage_region_code, p.coverage_region_name, p.coverage_communes,
                   lp.payment_status, lp.start_date as promotion_start_date,
                   lp.target_keywords,
                   (lp.payment_status = 'PAID') as is_sponsored,
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission
            FROM services s 
            JOIN provider_profiles p ON s.provider_id = p.user_id 
            LEFT JOIN service_categories sc ON s.category = sc.id
            LEFT JOIN LATERAL (
                SELECT sp.payment_status, sp.start_date, sp.end_date, sp.target_keywords
                FROM featured_promotions sp 
                WHERE sp.service_id = s.id
                  AND sp.payment_status = 'PAID'
                  AND sp.end_date > NOW()
                ORDER BY sp.start_date ASC
                LIMIT 1
            ) lp ON true
            WHERE s.is_active = true AND p.is_verified = true
        `;

        const params = [];
        let whereConditions = [];

        if (category) {
            params.push(category);
            whereConditions.push(`s.category = $${params.length}`);
        }

        if (q) {
            params.push(`%${q}%`);
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
        if (q) {
            query += `
                ORDER BY 
                CASE WHEN lp.payment_status = 'PAID' THEN 0 ELSE 1 END,
                lp.start_date ASC, 
                s.created_at DESC
            `;
        } else {
            query += ' ORDER BY s.created_at DESC';
        }

        const result = await pool.query(query, params);

        res.json({
            status: 'success',
            count: result.rows.length,
            services: result.rows.map(row => ({
                ...row,
                isSponsored: !!row.is_sponsored // Convert to boolean for frontend
            }))
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
                   COALESCE(sc.commission_percentage, 10) as commission_percentage,
                   COALESCE(sc.commission_type, 'PERCENTAGE') as commission_type,
                   COALESCE(sc.fixed_commission, 0) as fixed_commission
            FROM services s 
            JOIN provider_profiles p ON s.provider_id = p.user_id 
            LEFT JOIN service_categories sc ON s.category = sc.id
            WHERE s.id = $1 AND p.is_verified = true
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Service not found' });
        }

        res.json({
            status: 'success',
            service: result.rows[0]
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
            SELECT s.*, p.full_name as provider_name 
            FROM services s 
            LEFT JOIN provider_profiles p ON s.provider_id = p.user_id 
            WHERE s.provider_id = $1
            ORDER BY s.created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const services = result.rows.map(row => ({
            ...row,
            id: String(row.id),
            name: row.title,
            price_clp: row.price,
            iva_clp: Math.round(row.price * 0.19),
            status: row.is_active ? 'active' : 'paused',
            videoUrl: row.video_url,
            coverImageUrl: row.cover_image_url || '',
            galleryMedia: row.gallery_media || [],
            // Map new fields or fallbacks
            duration_minutes: row.duration_minutes || 60,
            type: row.type || 'online',
            availability_type: row.availability_type || 'agenda',
            features: row.features || [],
            imageUrls: row.image_urls || [],
            calendar_config: row.calendar_config || {},
            pricing_type: row.pricing_type || 'per_event',
            categories: (row.categories_json && row.categories_json.length > 0)
                ? row.categories_json
                : [{ categoryId: row.category, subcategory: row.subcategory || row.category }],

            requires_kyc: false
        }));

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
            SELECT s.*, p.full_name as provider_name, u.email, p.phone
            FROM services s
            LEFT JOIN provider_profiles p ON s.provider_id = p.user_id
            LEFT JOIN users u ON s.provider_id = u.id
            ORDER BY s.created_at DESC
        `;
        const result = await pool.query(query);

        // Map to match the Service type expected by the frontend
        const services = result.rows.map(row => ({
            ...row,
            id: String(row.id),
            name: row.title,
            price_clp: row.price,
            imageUrls: row.image_urls || [],
            // Ensure provider object exists for the table display
            provider: {
                name: row.provider_name,
                email: row.email,
                phone: row.phone
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
