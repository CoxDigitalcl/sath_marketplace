const normalizeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const absoluteUrl = (value, origin) => {
    if (!value) return null;
    try {
        const url = new URL(value, origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
        return null;
    }
};

const isKnownScope = (value) => {
    const scope = normalizeText(value);
    if (!scope) return false;
    return !/(?:por confirmar|pendiente|desconocid[oa])/i.test(scope);
};

const buildBreadcrumbs = ({ page, canonical, origin }) => {
    const items = Array.isArray(page?.breadcrumbs) ? page.breadcrumbs : [];
    if (items.length === 0) return null;

    return {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumbs`,
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: normalizeText(item.label),
            item: absoluteUrl(item.href, origin) || canonical
        }))
    };
};

const buildServiceNodes = ({ page, canonical, origin }) => {
    if (page?.kind !== 'service') return [];

    const serviceId = `${canonical}#service`;
    const providerUrl = absoluteUrl(page.provider?.href, origin);
    const providerId = providerUrl ? `${providerUrl}#provider` : null;
    const price = Number(page.price);
    const service = {
        '@type': 'Service',
        '@id': serviceId,
        name: normalizeText(page.heading),
        description: normalizeText(page.fullDescription || page.description),
        url: canonical
    };

    if (providerId) {
        service.provider = {
            '@id': providerId,
            name: normalizeText(page.provider?.name),
            url: providerUrl
        };
    }
    if (normalizeText(page.serviceType)) service.serviceType = normalizeText(page.serviceType);
    if (isKnownScope(page.scope)) service.areaServed = normalizeText(page.scope);
    if (page.lastUpdated) service.dateModified = String(page.lastUpdated).slice(0, 10);

    const nodes = [service];
    if (Number.isFinite(price) && price >= 0) {
        const offer = {
            '@type': 'Offer',
            '@id': `${canonical}#offer`,
            url: canonical,
            price: String(price),
            priceCurrency: page.priceCurrency || 'CLP',
            itemOffered: { '@id': serviceId },
            description: 'Precio publicado; la disponibilidad y el valor final se confirman antes del pago.'
        };
        if (providerId) offer.seller = { '@id': providerId };
        service.offers = { '@id': offer['@id'] };
        nodes.push(offer);
    }

    return nodes;
};

export const buildPublicStructuredData = ({ document, siteOrigin }) => {
    if (!document || document.status !== 200 || document.indexable === false) return null;

    const origin = absoluteUrl('/', siteOrigin);
    const canonical = absoluteUrl(document.canonical, origin);
    const page = document.page;
    if (!origin || !canonical || !page) return null;

    const organizationId = `${origin}#organization`;
    const websiteId = `${origin}#website`;
    const breadcrumb = buildBreadcrumbs({ page, canonical, origin });
    const webPage = {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: normalizeText(page.heading),
        description: normalizeText(page.description),
        isPartOf: { '@id': websiteId },
        about: { '@id': organizationId }
    };
    if (breadcrumb) webPage.breadcrumb = { '@id': breadcrumb['@id'] };
    if (page.kind === 'service') webPage.mainEntity = { '@id': `${canonical}#service` };

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': organizationId,
                name: 'Servicios a tu Hogar',
                url: origin,
                logo: absoluteUrl('/images/logo-sath-26.png', origin)
            },
            {
                '@type': 'WebSite',
                '@id': websiteId,
                name: 'Servicios a tu Hogar',
                url: origin,
                publisher: { '@id': organizationId }
            },
            webPage,
            ...(breadcrumb ? [breadcrumb] : []),
            ...buildServiceNodes({ page, canonical, origin })
        ]
    };
};


export const serializeStructuredData = (value) => JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');
