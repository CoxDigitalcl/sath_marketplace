import {
    PUBLIC_CATEGORIES,
    getPublicCategory,
    loadPublicDynamicSitemapPaths,
    loadPublicPolicySeo,
    loadPublicProviderPage,
    loadPublicServiceCards,
    loadPublicServiceSeo
} from './publicSeoData.js';
import { getSiteOrigin } from './seoService.legacy.js';
import {
    buildProviderPath,
    buildServicePath,
    PUBLIC_SLUG_PATTERN_SOURCE,
    PUBLIC_UUID_PATTERN_SOURCE
} from '../../shared/publicPaths.js';
import {
    getAvailabilityLabel,
    getPricingBasisLabel,
    parsePublicServiceDescription
} from '../../shared/publicContent.js';

const PUBLIC_DETAIL_SEGMENT = `(?:(${PUBLIC_SLUG_PATTERN_SOURCE})-)?(${PUBLIC_UUID_PATTERN_SOURCE})`;
const CATEGORY_SEGMENT = PUBLIC_SLUG_PATTERN_SOURCE;
const DEFAULT_LOADER_TIMEOUT_MS = 2500;

const normalizePathname = (pathname = '/') => {
    const rawPath = String(pathname || '/').split(/[?#]/, 1)[0];
    const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (withLeadingSlash === '/') return '/';
    return withLeadingSlash.replace(/\/+$/, '') || '/';
};

const normalizeSingleLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const stripHtml = (value) => String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split(/\n+/)
    .map(normalizeSingleLine)
    .filter(Boolean);

const parseImageList = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
    } catch {
        return [value];
    }
};

const safeImageUrl = (value) => {
    if (!value) return undefined;
    try {
        const url = new URL(value, getSiteOrigin());
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
    } catch {
        return undefined;
    }
};

const formatPrice = (value) => {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) return 'Precio a convenir';
    return `$${Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};

const getScope = (record = {}) => normalizeSingleLine(
    record.coverage_area
    || record.coverage_region_name
    || (record.type === 'online' ? 'Atención online' : 'Cobertura por confirmar')
);

const categoryItems = () => PUBLIC_CATEGORIES.map((category) => ({
    ...category,
    href: `/categories/${category.slug}`
}));

const toServiceItem = (service) => ({
    href: buildServicePath(service.id, service.title),
    title: normalizeSingleLine(service.title) || 'Servicio',
    description: parsePublicServiceDescription(service.description).plainText.slice(0, 180),
    providerName: normalizeSingleLine(service.provider_name) || 'Proveedor verificado',
    providerHref: service.provider_id ? buildProviderPath(service.provider_id, service.provider_name) : null,
    priceLabel: formatPrice(service.price),
    scope: getScope(service)
});

const createMatcher = (pattern, paramNames = []) => (pathname) => {
    const match = pathname.match(pattern);
    if (!match) return null;
    return Object.fromEntries(paramNames.map((name, index) => [name, match[index + 1]]));
};

const exactMatcher = (expected) => (pathname) => pathname === expected ? {} : null;

const makeCanonical = (pathname) => new URL(pathname, getSiteOrigin()).toString();

const publicDefinitions = [
    {
        id: 'home',
        classification: 'public-indexable',
        renderMode: 'ssr',
        indexable: true,
        sitemap: true,
        staticSitemapPaths: ['/'],
        match: exactMatcher('/'),
        load: async ({ db }) => ({ services: await loadPublicServiceCards(db, { limit: 6 }) }),
        build: ({ pathname, data }) => ({
            status: 200,
            canonical: makeCanonical(pathname),
            seo: {
                title: 'Servicios a tu Hogar | Profesionales y servicios en Chile',
                description: 'Encuentra profesionales verificados y servicios para tu hogar en Chile.'
            },
            page: {
                kind: 'home',
                routeId: 'home',
                heading: 'Encuentra servicios confiables para tu hogar en Chile',
                description: 'Explora servicios publicados por proveedores verificados y revisa su cobertura antes de reservar.',
                breadcrumbs: [],
                categories: categoryItems(),
                services: data.services.map(toServiceItem)
            }
        })
    },
    {
        id: 'categories',
        classification: 'public-indexable',
        renderMode: 'ssr',
        indexable: true,
        sitemap: true,
        staticSitemapPaths: ['/categories'],
        match: exactMatcher('/categories'),
        load: async () => ({}),
        build: ({ pathname }) => ({
            status: 200,
            canonical: makeCanonical(pathname),
            seo: {
                title: 'Categorías de servicios | Servicios a tu Hogar',
                description: 'Explora categorías de servicios para el hogar y encuentra profesionales disponibles en Chile.'
            },
            page: {
                kind: 'categories',
                routeId: 'categories',
                heading: 'Categorías de servicios',
                description: 'Elige una categoría para revisar servicios activos ofrecidos por proveedores verificados.',
                breadcrumbs: [{ href: '/', label: 'Inicio' }, { label: 'Categorías' }],
                categories: categoryItems()
            }
        })
    },
    {
        id: 'category',
        classification: 'public-indexable-conditional',
        renderMode: 'ssr',
        indexable: true,
        sitemap: true,
        staticSitemapPaths: [],
        match: createMatcher(new RegExp(`^/categories/(${CATEGORY_SEGMENT})$`), ['slug']),
        load: async ({ db, params }) => {
            const category = getPublicCategory(params.slug);
            if (!category) return null;
            return {
                category,
                services: await loadPublicServiceCards(db, { category: category.slug, limit: 24 })
            };
        },
        build: ({ pathname, data }) => ({
            status: 200,
            indexable: data.services.length > 0,
            canonical: makeCanonical(pathname),
            seo: {
                title: `${data.category.name} | Servicios a tu Hogar`,
                description: data.category.description
            },
            page: {
                kind: 'category',
                routeId: 'category',
                heading: data.category.name,
                description: data.category.description,
                breadcrumbs: [
                    { href: '/', label: 'Inicio' },
                    { href: '/categories', label: 'Categorías' },
                    { label: data.category.name }
                ],
                services: data.services.map(toServiceItem)
            }
        })
    },
    {
        id: 'service',
        classification: 'public-indexable-conditional',
        renderMode: 'ssr',
        indexable: true,
        sitemap: true,
        staticSitemapPaths: [],
        match: createMatcher(new RegExp(`^/service/${PUBLIC_DETAIL_SEGMENT}$`), ['slug', 'id']),
        load: ({ db, params }) => loadPublicServiceSeo(db, params.id),
        build: ({ pathname, data }) => {
            const title = normalizeSingleLine(data.title) || 'Detalle del servicio';
            const parsedDescription = parsePublicServiceDescription(data.description);
            const description = parsedDescription.plainText
                || `Revisa el detalle y la cobertura del servicio ofrecido por ${normalizeSingleLine(data.provider_name) || 'un proveedor con identidad verificada'}.`;
            const firstImage = data.cover_image_url || parseImageList(data.image_urls).find(Boolean);
            const providerName = normalizeSingleLine(data.provider_name) || 'Proveedor verificado';
            const canonicalPath = buildServicePath(data.id, title);
            if (pathname !== canonicalPath) {
                return { status: 308, redirectTo: canonicalPath };
            }
            return {
                status: 200,
                indexable: true,
                canonical: makeCanonical(canonicalPath),
                seo: {
                    title: `${title} | Servicios a tu Hogar`,
                    description: description.slice(0, 160),
                    image: safeImageUrl(firstImage)
                },
                page: {
                    kind: 'service',
                    routeId: 'service',
                    heading: title,
                    description: description.slice(0, 220),
                    fullDescription: description,
                    descriptionSections: parsedDescription.sections,
                    price: Number.isFinite(Number(data.price)) ? Number(data.price) : null,
                    priceCurrency: 'CLP',
                    priceLabel: formatPrice(data.price),
                    scope: getScope(data),
                    serviceType: normalizeSingleLine(data.type),
                    category: normalizeSingleLine(data.category),
                    pricingType: normalizeSingleLine(data.pricing_type),
                    availabilityType: normalizeSingleLine(data.availability_type),
                    durationMinutes: Number(data.duration_minutes) || null,
                    pricingBasis: getPricingBasisLabel(data.pricing_type, data.duration_minutes),
                    availabilitySummary: getAvailabilityLabel(data.availability_type),
                    features: parseImageList(data.features).map(normalizeSingleLine).filter(Boolean),
                    lastUpdated: data.updated_at ? String(data.updated_at).slice(0, 10) : null,
                    termsHref: '/legal/terminos-y-condiciones-de-uso',
                    provider: {
                        name: providerName,
                        href: buildProviderPath(data.provider_id, providerName)
                    },
                    breadcrumbs: [
                        { href: '/', label: 'Inicio' },
                        { href: '/categories', label: 'Categorías' },
                        { label: title }
                    ]
                }
            };
        }
    },
    {
        id: 'provider',
        classification: 'public-indexable-conditional',
        renderMode: 'ssr',
        indexable: true,
        sitemap: true,
        staticSitemapPaths: [],
        match: createMatcher(new RegExp(`^/provider/${PUBLIC_DETAIL_SEGMENT}$`), ['slug', 'id']),
        load: ({ db, params }) => loadPublicProviderPage(db, params.id),
        build: ({ pathname, data }) => {
            const name = normalizeSingleLine(data.name) || 'Proveedor';
            const description = normalizeSingleLine(data.bio) || 'Conoce el perfil y los servicios de este profesional verificado.';
            const canonicalPath = buildProviderPath(data.id, name);
            if (pathname !== canonicalPath) {
                return { status: 308, redirectTo: canonicalPath };
            }
            return {
                status: 200,
                indexable: data.services.length > 0,
                canonical: makeCanonical(canonicalPath),
                seo: {
                    title: `${name} | Servicios a tu Hogar`,
                    description: description.slice(0, 160),
                    image: safeImageUrl(data.profile_image_url),
                    type: 'profile'
                },
                page: {
                    kind: 'provider',
                    routeId: 'provider',
                    heading: name,
                    description,
                    scope: getScope(data),
                    breadcrumbs: [
                        { href: '/', label: 'Inicio' },
                        { label: name }
                    ],
                    services: data.services.map(toServiceItem)
                }
            };
        }
    },
    {
        id: 'legal',
        classification: 'public-indexable-conditional',
        renderMode: 'ssr',
        indexable: true,
        sitemap: true,
        staticSitemapPaths: [],
        match: createMatcher(new RegExp(`^/legal/(${CATEGORY_SEGMENT})$`), ['slug']),
        load: ({ db, params }) => loadPublicPolicySeo(db, params.slug),
        build: ({ pathname, data }) => {
            const paragraphs = stripHtml(data.content);
            const policySummary = paragraphs.join(' ');
            const description = policySummary
                ? `${data.title}: ${policySummary}`.slice(0, 160)
                : `${data.title} de la plataforma Servicios a tu Hogar.`;
            return {
                status: 200,
                canonical: makeCanonical(pathname),
                seo: {
                    title: `${data.title} | Servicios a tu Hogar`,
                    description
                },
                page: {
                    kind: 'legal',
                    routeId: 'legal',
                    heading: data.title,
                    description,
                    lastUpdated: data.lastUpdated ? String(data.lastUpdated).slice(0, 10) : null,
                    paragraphs,
                    breadcrumbs: [
                        { href: '/', label: 'Inicio' },
                        { label: data.title }
                    ]
                }
            };
        }
    }
];

const clientDefinitions = [
    { id: 'search', classification: 'public-noindex', match: exactMatcher('/search') },
    { id: 'admin', classification: 'private-authenticated', match: exactMatcher('/admin') },
    { id: 'provider-dashboard', classification: 'private-authenticated', match: exactMatcher('/provider/dashboard') },
    { id: 'client-dashboard', classification: 'private-authenticated', match: exactMatcher('/client/dashboard') },
    { id: 'auth', classification: 'public-sensitive-noindex', match: exactMatcher('/auth') },
    { id: 'login', classification: 'public-sensitive-noindex', match: exactMatcher('/login') },
    { id: 'provider-register', classification: 'public-sensitive-noindex', match: exactMatcher('/provider/register') },
    { id: 'client-register', classification: 'public-sensitive-noindex', match: exactMatcher('/client/register') },
    { id: 'forgot-password', classification: 'public-sensitive-noindex', match: exactMatcher('/forgot-password') },
    { id: 'reset-password', classification: 'tokenized-noindex', match: exactMatcher('/reset-password') },
    { id: 'checkout', classification: 'transactional-noindex', match: exactMatcher('/checkout') },
    { id: 'checkout-success', classification: 'transactional-noindex', match: exactMatcher('/checkout/success') },
    { id: 'style-guide', classification: 'internal-noindex', match: exactMatcher('/style-guide') }
].map((definition) => ({
    ...definition,
    renderMode: 'csr',
    indexable: false,
    sitemap: false,
    staticSitemapPaths: []
}));

export const PUBLIC_ROUTE_MANIFEST = Object.freeze(
    [...publicDefinitions, ...clientDefinitions].map((definition) => Object.freeze(definition))
);

export const resolveApplicationRoute = (pathname) => {
    const normalizedPathname = normalizePathname(pathname);
    for (const definition of PUBLIC_ROUTE_MANIFEST) {
        const params = definition.match(normalizedPathname);
        if (params) return { definition, params, pathname: normalizedPathname };
    }
    return null;
};

export const isKnownApplicationRoute = (pathname) => Boolean(resolveApplicationRoute(pathname));

const getLoaderTimeout = () => {
    const configured = Number(process.env.SSR_LOADER_TIMEOUT_MS);
    return Number.isSafeInteger(configured) && configured >= 250 && configured <= 10000
        ? configured
        : DEFAULT_LOADER_TIMEOUT_MS;
};

const runWithTimeout = async (operation, timeoutMs) => {
    let timeout;
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => {
                timeout = setTimeout(() => {
                    const error = new Error('Public SSR loader timed out');
                    error.code = 'SSR_LOADER_TIMEOUT';
                    reject(error);
                }, timeoutMs);
            })
        ]);
    } finally {
        clearTimeout(timeout);
    }
};

export const loadPublicRouteDocument = async ({ db, pathname }) => {
    const resolved = resolveApplicationRoute(pathname);
    if (!resolved || resolved.definition.renderMode !== 'ssr') return null;

    const data = await runWithTimeout(
        () => resolved.definition.load({ db, params: resolved.params, pathname: resolved.pathname }),
        getLoaderTimeout()
    );
    if (!data) {
        return {
            status: 404,
            canonical: null,
            definition: resolved.definition,
            page: null,
            seo: null
        };
    }

    const document = resolved.definition.build({
        data,
        params: resolved.params,
        pathname: resolved.pathname
    });

    if (document.redirectTo) {
        return { ...document, definition: resolved.definition };
    }

    return {
        ...document,
        definition: resolved.definition,
        seo: {
            ...document.seo,
            canonical: document.canonical
        }
    };
};

export const loadPublicSitemapPaths = async (db) => {
    const staticPaths = publicDefinitions.flatMap((definition) => definition.staticSitemapPaths);
    const dynamicPaths = await loadPublicDynamicSitemapPaths(db);
    return [...new Set([...staticPaths, ...dynamicPaths])];
};

export const createSsrFailurePage = () => ({
    kind: 'error',
    routeId: 'ssr-loader-error',
    heading: 'No pudimos cargar esta página',
    description: 'El contenido público no está disponible temporalmente. Intenta nuevamente en unos minutos.',
    breadcrumbs: [{ href: '/', label: 'Inicio' }]
});
