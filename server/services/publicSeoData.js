import { isValidUuid } from '../utils/identifiers.js';

export const PUBLIC_CATEGORIES = Object.freeze([
    Object.freeze({
        slug: 'hogar',
        name: 'Hogar y Mantención',
        description: 'Encuentra servicios de mantención, reparación y apoyo para el hogar.'
    }),
    Object.freeze({
        slug: 'clases',
        name: 'Clases y Tutorías',
        description: 'Explora clases, tutorías y apoyo educativo ofrecido por profesionales.'
    }),
    Object.freeze({
        slug: 'salud',
        name: 'Salud y Bienestar',
        description: 'Encuentra servicios de salud y bienestar disponibles para atención particular.'
    }),
    Object.freeze({
        slug: 'eventos',
        name: 'Eventos y Entretenimiento',
        description: 'Explora servicios para organizar, apoyar y producir eventos.'
    }),
    Object.freeze({
        slug: 'automoviles',
        name: 'Automóviles',
        description: 'Encuentra servicios de apoyo, mantención y cuidado para automóviles.'
    }),
    Object.freeze({
        slug: 'fletes',
        name: 'Fletes',
        description: 'Explora servicios de traslado, retiro y entrega de carga.'
    }),
    Object.freeze({
        slug: 'colegio',
        name: 'Colegio',
        description: 'Encuentra servicios y actividades de apoyo para comunidades escolares.'
    })
]);

const PUBLIC_CATEGORY_BY_SLUG = new Map(
    PUBLIC_CATEGORIES.map((category) => [category.slug, category])
);

const normalizeSingleLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const slugify = (value) => normalizeSingleLine(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

const isSafeSlug = (value) => /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(value);

const decodeJsonValue = (value) => {
    let decoded = value;

    for (let attempt = 0; attempt < 2 && typeof decoded === 'string'; attempt += 1) {
        try {
            decoded = JSON.parse(decoded);
        } catch {
            break;
        }
    }

    return decoded;
};

const collectPolicyCandidates = (value, output) => {
    const decoded = decodeJsonValue(value);
    if (Array.isArray(decoded)) {
        decoded.forEach((entry) => collectPolicyCandidates(entry, output));
        return;
    }

    if (!decoded || typeof decoded !== 'object') return;

    if ('title' in decoded || 'slug' in decoded) {
        output.push(decoded);
        return;
    }

    for (const key of ['value', 'legal_policies', 'policies']) {
        if (key in decoded) collectPolicyCandidates(decoded[key], output);
    }
};

const normalizePublicPolicy = (candidate) => {
    const isActive = candidate?.isActive === true
        || candidate?.is_active === true
        || candidate?.isActive === 'true'
        || candidate?.is_active === 'true';
    const title = normalizeSingleLine(candidate?.title);
    const content = typeof candidate?.content === 'string' ? candidate.content.trim() : '';
    const slug = slugify(candidate?.slug || title);

    if (!isActive || !title || !content || !isSafeSlug(slug)) return null;

    return {
        slug,
        title,
        content,
        lastUpdated: candidate?.lastUpdated || candidate?.updated_at || null
    };
};

const getQuery = (db) => {
    if (!db?.pool?.query) throw new Error('A database pool is required for public SEO data');
    return db.pool.query.bind(db.pool);
};

export const getPublicCategory = (slug) => PUBLIC_CATEGORY_BY_SLUG.get(String(slug || '').toLowerCase()) || null;

export const loadPublicServiceSeo = async (db, id) => {
    if (!isValidUuid(id)) return null;

    const query = getQuery(db);
    const result = await query(`
        SELECT
            s.id,
            s.title,
            s.description,
            s.image_urls,
            COALESCE(pp.store_name, pp.full_name, 'Proveedor') AS provider_name
        FROM services s
        JOIN provider_profiles pp ON pp.user_id = s.provider_id
        JOIN users u ON u.id = s.provider_id
        WHERE s.id = $1
          AND s.is_active = TRUE
          AND s.moderation_status = 'approved'
          AND pp.is_verified = TRUE
          AND COALESCE(u.is_blocked, FALSE) = FALSE
        LIMIT 1
    `, [id]);

    return result.rows[0] || null;
};

export const loadPublicProviderSeo = async (db, id) => {
    if (!isValidUuid(id)) return null;

    const query = getQuery(db);
    const result = await query(`
        SELECT
            pp.user_id AS id,
            COALESCE(pp.store_name, pp.full_name, 'Proveedor') AS name,
            pp.bio,
            CASE
                WHEN pp.profile_image_status = 'approved' THEN pp.profile_image_url
                ELSE NULL
            END AS profile_image_url
        FROM provider_profiles pp
        JOIN users u ON u.id = pp.user_id
        WHERE pp.user_id = $1
          AND u.role = 'provider'
          AND pp.is_verified = TRUE
          AND COALESCE(u.is_blocked, FALSE) = FALSE
        LIMIT 1
    `, [id]);

    return result.rows[0] || null;
};

export const loadPublicPolicies = async (db) => {
    const query = getQuery(db);
    let result;

    try {
        result = await query(`
            SELECT key, value, updated_at
            FROM platform_settings
            WHERE group_name = 'legal_policies'
            ORDER BY updated_at DESC
        `);
    } catch (error) {
        if (error?.code === '42P01') return [];
        throw error;
    }

    const candidates = [];
    result.rows.forEach((row) => collectPolicyCandidates(row.value, candidates));

    const policiesBySlug = new Map();
    for (const candidate of candidates) {
        const policy = normalizePublicPolicy(candidate);
        if (policy && !policiesBySlug.has(policy.slug)) {
            policiesBySlug.set(policy.slug, policy);
        }
    }

    return [...policiesBySlug.values()];
};

export const loadPublicPolicySeo = async (db, slug) => {
    const normalizedSlug = String(slug || '').toLowerCase();
    if (!isSafeSlug(normalizedSlug)) return null;

    const policies = await loadPublicPolicies(db);
    return policies.find((policy) => policy.slug === normalizedSlug) || null;
};

export const loadPublicSitemapPaths = async (db) => {
    const query = getQuery(db);
    const [servicesResult, providersResult, policies] = await Promise.all([
        query(`
            SELECT s.id
            FROM services s
            JOIN provider_profiles pp ON pp.user_id = s.provider_id
            JOIN users u ON u.id = s.provider_id
            WHERE s.is_active = TRUE
              AND s.moderation_status = 'approved'
              AND pp.is_verified = TRUE
              AND COALESCE(u.is_blocked, FALSE) = FALSE
            ORDER BY s.created_at DESC
            LIMIT 20000
        `),
        query(`
            SELECT pp.user_id AS id
            FROM provider_profiles pp
            JOIN users u ON u.id = pp.user_id
            WHERE u.role = 'provider'
              AND pp.is_verified = TRUE
              AND COALESCE(u.is_blocked, FALSE) = FALSE
            ORDER BY pp.user_id
            LIMIT 20000
        `),
        loadPublicPolicies(db)
    ]);

    const paths = [
        '/',
        '/categories',
        ...PUBLIC_CATEGORIES.map((category) => `/categories/${category.slug}`),
        ...servicesResult.rows
            .map((row) => row.id)
            .filter(isValidUuid)
            .map((id) => `/service/${id}`),
        ...providersResult.rows
            .map((row) => row.id)
            .filter(isValidUuid)
            .map((id) => `/provider/${id}`),
        ...policies.map((policy) => `/legal/${policy.slug}`)
    ];

    return [...new Set(paths)];
};
