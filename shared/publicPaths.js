export const PUBLIC_UUID_PATTERN_SOURCE = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
export const PUBLIC_SLUG_PATTERN_SOURCE = '[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?';

const PUBLIC_UUID_AT_END = new RegExp(`(${PUBLIC_UUID_PATTERN_SOURCE})$`);

export const slugifyPublicPathSegment = (value, fallback = 'detalle') => {
    const slug = String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100)
        .replace(/-+$/g, '');

    return slug || fallback;
};

export const extractPublicUuid = (value) => {
    const match = String(value ?? '').match(PUBLIC_UUID_AT_END);
    return match?.[1] || '';
};

export const buildServicePath = (id, title) => {
    const uuid = extractPublicUuid(id);
    if (!uuid) return '/categories';
    return `/service/${slugifyPublicPathSegment(title, 'servicio')}-${uuid}`;
};

export const buildProviderPath = (id, name) => {
    const uuid = extractPublicUuid(id);
    if (!uuid) return '/categories';
    return `/provider/${slugifyPublicPathSegment(name, 'profesional')}-${uuid}`;
};
