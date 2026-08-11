export {
    SEO_CACHE_HEADERS,
    buildRobotsTxt,
    buildSitemapXml,
    getSiteOrigin,
    injectSeoMetadata,
    isKnownSpaRoute,
} from './seoService.legacy.js';

import { getRouteSeo as getLegacyRouteSeo } from './seoService.legacy.js';

export const getRouteSeo = (options = {}) => {
    const seo = getLegacyRouteSeo(options);
    return options.forceNoindex
        ? { ...seo, canonical: null }
        : seo;
};
