export {
    SEO_CACHE_HEADERS,
    buildRobotsTxt,
    getSiteOrigin,
    injectSeoMetadata
} from './seoService.legacy.js';
export { isKnownApplicationRoute as isKnownSpaRoute } from './publicRouteManifest.js';

import {
    buildSitemapXml as buildStaticSitemapXml,
    getRouteSeo as getLegacyRouteSeo,
    getSiteOrigin
} from './seoService.legacy.js';

const escapeXml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeSitemapPaths = (paths) => [...new Set(paths)]
    .filter((pathname) => (
        typeof pathname === 'string'
        && pathname.startsWith('/')
        && !pathname.startsWith('//')
        && !pathname.includes('?')
        && !pathname.includes('#')
    ));

export const buildSitemapXml = (origin = getSiteOrigin(), paths) => {
    if (!Array.isArray(paths)) return buildStaticSitemapXml(origin);

    const entries = normalizeSitemapPaths(paths).map((pathname) => [
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

export const getRouteSeo = (options = {}) => {
    const seo = getLegacyRouteSeo(options);
    if (options.forceNoindex) return { ...seo, canonical: null };

    const canonical = options.overrides
        && Object.prototype.hasOwnProperty.call(options.overrides, 'canonical')
        ? options.overrides.canonical
        : seo.canonical;

    return { ...seo, canonical };
};
