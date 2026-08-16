import { serializeStructuredData } from './structuredData.js';

const DEFAULT_SITE_ORIGIN = 'https://serviciosatuhogar.cl';

const STATIC_SITEMAP_PATHS = Object.freeze([
    '/',
    '/categories'
]);

const PRIVATE_ROUTE_PATTERNS = Object.freeze([
    /^\/admin(?:\/|$)/,
    /^\/provider\/dashboard(?:\/|$)/,
    /^\/client\/dashboard(?:\/|$)/,
    /^\/auth(?:\/|$)/,
    /^\/login(?:\/|$)/,
    /^\/provider\/register(?:\/|$)/,
    /^\/client\/register(?:\/|$)/,
    /^\/forgot-password(?:\/|$)/,
    /^\/reset-password(?:\/|$)/,
    /^\/checkout(?:\/|$)/,
    /^\/style-guide(?:\/|$)/
]);

const SENSITIVE_QUERY_KEYS = new Set([
    'token',
    'access_token',
    'refresh_token',
    'order',
    'payment_key',
    'transaction_id',
    'mock_payment'
]);

const UUID_PATH_SEGMENT = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const KNOWN_SPA_ROUTE_PATTERNS = Object.freeze([
    /^\/$/,
    /^\/search$/,
    /^\/categories$/,
    /^\/categories\/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/,
    new RegExp(`^/service/${UUID_PATH_SEGMENT}$`),
    new RegExp(`^/provider/${UUID_PATH_SEGMENT}$`),
    /^\/checkout$/,
    /^\/checkout\/success$/,
    /^\/legal\/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/,
    /^\/admin$/,
    /^\/provider\/dashboard$/,
    /^\/client\/dashboard$/,
    /^\/auth$/,
    /^\/provider\/register$/,
    /^\/client\/register$/,
    /^\/login$/,
    /^\/forgot-password$/,
    /^\/reset-password$/,
    /^\/style-guide$/
]);

const LEGAL_TITLES = Object.freeze({
    'terminos-y-condiciones-de-uso': 'Términos y condiciones',
    'politica-de-privacidad': 'Política de privacidad',
    'politica-de-reembolsos': 'Política de reembolsos'
});

const normalizePathname = (pathname = '/') => {
    const rawPath = String(pathname || '/').split(/[?#]/, 1)[0];
    const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (withLeadingSlash === '/') return '/';
    return withLeadingSlash.replace(/\/+$/, '') || '/';
};

const humanizeSlug = (slug) => slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeXml = (value) => escapeHtml(value);

export const getSiteOrigin = (environment = process.env) => {
    const candidate = environment.APP_URL || environment.FRONTEND_URL || DEFAULT_SITE_ORIGIN;

    try {
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_SITE_ORIGIN;
        return parsed.origin;
    } catch {
        return DEFAULT_SITE_ORIGIN;
    }
};

export const isKnownSpaRoute = (pathname) => {
    const normalizedPath = normalizePathname(pathname);
    return KNOWN_SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(normalizedPath));
};

const hasSensitiveQuery = (query) => {
    if (!query) return false;

    if (query instanceof URLSearchParams) {
        return [...query.keys()].some((key) => SENSITIVE_QUERY_KEYS.has(key.toLowerCase()));
    }

    return Object.keys(query).some((key) => SENSITIVE_QUERY_KEYS.has(key.toLowerCase()));
};

const getRobotsDirective = (pathname, query) => {
    if (hasSensitiveQuery(query)) return 'noindex, nofollow, noarchive';
    if (PRIVATE_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))) {
        return 'noindex, nofollow, noarchive';
    }
    if (pathname === '/search') return 'noindex, follow';
    return 'index, follow';
};

const getPageCopy = (pathname) => {
    if (pathname === '/') {
        return {
            title: 'Servicios a tu Hogar | Profesionales y servicios en Chile',
            description: 'Encuentra profesionales verificados y servicios para tu hogar en Chile.'
        };
    }

    if (pathname === '/categories') {
        return {
            title: 'Categorías de servicios | Servicios a tu Hogar',
            description: 'Explora categorías de servicios para el hogar y encuentra profesionales disponibles en Chile.'
        };
    }

    const categoryMatch = pathname.match(/^\/categories\/([a-z0-9-]+)$/);
    if (categoryMatch) {
        return {
            title: `${humanizeSlug(categoryMatch[1])} | Servicios a tu Hogar`,
            description: `Explora servicios de ${humanizeSlug(categoryMatch[1]).toLowerCase()} y encuentra profesionales en Chile.`
        };
    }

    if (pathname.startsWith('/service/')) {
        return {
            title: 'Detalle del servicio | Servicios a tu Hogar',
            description: 'Revisa el detalle, cobertura y condiciones de este servicio.'
        };
    }

    if (pathname.startsWith('/provider/')) {
        return {
            title: 'Perfil profesional | Servicios a tu Hogar',
            description: 'Conoce el perfil y los servicios de este profesional.'
        };
    }

    const legalMatch = pathname.match(/^\/legal\/([a-z0-9-]+)$/);
    if (legalMatch) {
        const legalTitle = LEGAL_TITLES[legalMatch[1]] || 'Documento legal';
        return {
            title: `${legalTitle} | Servicios a tu Hogar`,
            description: `${legalTitle} de la plataforma Servicios a tu Hogar.`
        };
    }

    if (pathname === '/search') {
        return {
            title: 'Buscar servicios | Servicios a tu Hogar',
            description: 'Busca servicios por categoría y ubicación.'
        };
    }

    return {
        title: 'Área privada | Servicios a tu Hogar',
        description: 'Acceso a una sección privada o transaccional de Servicios a tu Hogar.'
    };
};

export const getRouteSeo = ({ pathname = '/', query, overrides = {}, forceNoindex = false } = {}) => {
    const normalizedPath = normalizePathname(pathname);
    const origin = getSiteOrigin();
    const pageCopy = getPageCopy(normalizedPath);
    const robots = forceNoindex ? 'noindex, nofollow, noarchive' : getRobotsDirective(normalizedPath, query);
    const isPrivate = PRIVATE_ROUTE_PATTERNS.some((pattern) => pattern.test(normalizedPath));

    return {
        title: overrides.title || pageCopy.title,
        description: overrides.description || pageCopy.description,
        canonical: isPrivate ? null : new URL(normalizedPath, origin).toString(),
        image: overrides.image || new URL('/images/logo-sath-26.png', origin).toString(),
        type: overrides.type || 'website',
        robots
    };
};

const removeManagedHeadTags = (html) => html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:title|description|image|url|type)["'])[^>]*>\s*/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*id=["']seo-structured-data["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

export const injectSeoMetadata = (html, seo) => {
    if (!html || !/<\/head>/i.test(html)) return html;

    const canonicalTag = seo.canonical
        ? `    <link rel="canonical" href="${escapeHtml(seo.canonical)}" />\n`
        : '';
    const socialTags = seo.canonical
        ? [
            `    <meta property="og:title" content="${escapeHtml(seo.title)}" />`,
            `    <meta property="og:description" content="${escapeHtml(seo.description)}" />`,
            `    <meta property="og:image" content="${escapeHtml(seo.image)}" />`,
            `    <meta property="og:url" content="${escapeHtml(seo.canonical)}" />`,
            `    <meta property="og:type" content="${escapeHtml(seo.type)}" />`,
            '    <meta name="twitter:card" content="summary_large_image" />',
            `    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
            `    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
            `    <meta name="twitter:image" content="${escapeHtml(seo.image)}" />`
        ].join('\n') + '\n'
        : '';
    const structuredDataTag = seo.structuredData
        ? `    <script id="seo-structured-data" type="application/ld+json">${serializeStructuredData(seo.structuredData)}</script>`
        : '';
    const tags = [
        `    <title>${escapeHtml(seo.title)}</title>`,
        `    <meta name="description" content="${escapeHtml(seo.description)}" />`,
        `    <meta name="robots" content="${escapeHtml(seo.robots)}" />`,
        canonicalTag.trimEnd(),
        socialTags.trimEnd(),
        structuredDataTag
    ].filter(Boolean).join('\n') + '\n';

    return removeManagedHeadTags(html).replace(/<\/head>/i, `${tags}</head>`);
};

export const buildRobotsTxt = (origin = getSiteOrigin()) => [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /provider/dashboard',
    'Disallow: /client/dashboard',
    'Disallow: /auth',
    'Disallow: /login',
    'Disallow: /provider/register',
    'Disallow: /client/register',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /checkout',
    'Disallow: /style-guide',
    '',
    `Sitemap: ${new URL('/sitemap.xml', origin).toString()}`,
    ''
].join('\n');

export const buildSitemapXml = (origin = getSiteOrigin()) => {
    const entries = STATIC_SITEMAP_PATHS.map((pathname) => [
        '  <url>',
        `    <loc>${escapeXml(new URL(pathname, origin).toString())}</loc>`,
        '  </url>'
    ].join('\n')).join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        entries,
        '</urlset>',
        ''
    ].join('\n');
};

export const SEO_CACHE_HEADERS = Object.freeze({
    html: 'no-cache, no-store, must-revalidate',
    discovery: 'public, max-age=3600, stale-while-revalidate=86400'
});

