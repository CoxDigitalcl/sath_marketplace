import express from 'express';
import fs from 'fs';
import path from 'path';

import {
    SEO_CACHE_HEADERS,
    buildRobotsTxt,
    buildSitemapXml,
    getRouteSeo,
    getSiteOrigin,
    injectSeoMetadata,
    isKnownSpaRoute
} from '../services/seoService.js';
import {
    getPublicCategory,
    loadPublicPolicySeo,
    loadPublicProviderSeo,
    loadPublicServiceSeo,
    loadPublicSitemapPaths
} from '../services/publicSeoData.js';

const NOINDEX = 'noindex, nofollow, noarchive';

const normalizeSingleLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const stripHtml = (value) => normalizeSingleLine(
    String(value ?? '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
);

const getSafeImageUrl = (candidate, siteOrigin) => {
    if (!candidate) return undefined;

    try {
        const parsed = new URL(candidate, siteOrigin);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
    } catch {
        return undefined;
    }
};

const getFirstImage = (value) => {
    let images = value;
    if (typeof images === 'string') {
        try {
            images = JSON.parse(images);
        } catch {
            images = [images];
        }
    }

    if (!Array.isArray(images)) return undefined;
    const first = images.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return first?.trim();
};

export const createSeoFrontendRouter = ({ buildPath, db, indexHtml } = {}) => {
    if (!buildPath && typeof indexHtml !== 'string') {
        throw new Error('buildPath or indexHtml is required to serve the frontend');
    }

    const router = express.Router();
    const siteOrigin = getSiteOrigin();
    const indexPath = buildPath ? path.join(buildPath, 'index.html') : null;
    const loadIndexHtml = () => {
        if (typeof indexHtml === 'string') return indexHtml;
        return fs.readFileSync(indexPath, 'utf8');
    };

    const sendSpaShell = (req, res, { status = 200, overrides = {}, forceNoindex = false } = {}) => {
        let html;
        try {
            html = loadIndexHtml();
        } catch {
            return res.status(500).set('X-Robots-Tag', NOINDEX).send('Error loading frontend');
        }

        const seo = getRouteSeo({
            pathname: req.path,
            query: req.query,
            overrides,
            forceNoindex: forceNoindex || status >= 400
        });

        res.status(status);
        res.set('Cache-Control', SEO_CACHE_HEADERS.html);
        res.set('X-Robots-Tag', seo.robots);
        return res.type('html').send(injectSeoMetadata(html, seo));
    };

    const failLoader = (res, next, error) => {
        res.set('X-Robots-Tag', NOINDEX);
        return next(error);
    };

    router.get('/robots.txt', (req, res) => {
        res.set('Cache-Control', SEO_CACHE_HEADERS.discovery);
        res.set('X-Robots-Tag', 'noindex, follow');
        res.type('text/plain').send(buildRobotsTxt(siteOrigin));
    });

    router.get('/sitemap.xml', async (req, res, next) => {
        try {
            const paths = await loadPublicSitemapPaths(db);
            res.set('Cache-Control', SEO_CACHE_HEADERS.discovery);
            res.set('X-Robots-Tag', 'noindex, follow');
            return res.type('application/xml').send(buildSitemapXml(siteOrigin, paths));
        } catch (error) {
            return failLoader(res, next, error);
        }
    });

    if (buildPath) {
        router.use('/assets', express.static(path.join(buildPath, 'assets'), {
            immutable: true,
            maxAge: '1y'
        }));
        router.use(express.static(buildPath, {
            index: false,
            maxAge: '1h',
            setHeaders: (res, filePath) => {
                if (path.extname(filePath).toLowerCase() === '.html') {
                    res.setHeader('Cache-Control', SEO_CACHE_HEADERS.html);
                }
            }
        }));
    }

    const sendPrivateShell = (req, res) => sendSpaShell(req, res);

    // These paths must be handled before /provider/:id so they never reach the
    // public provider lookup.
    router.get('/provider/dashboard', sendPrivateShell);
    router.get('/provider/register', sendPrivateShell);

    router.get('/categories/:slug', (req, res) => {
        const category = getPublicCategory(req.params.slug);
        if (!category) return sendSpaShell(req, res, { status: 404, forceNoindex: true });

        return sendSpaShell(req, res, {
            overrides: {
                title: `${category.name} | Servicios a tu Hogar`,
                description: category.description
            }
        });
    });

    router.get('/service/:id', async (req, res, next) => {
        try {
            const service = await loadPublicServiceSeo(db, req.params.id);
            if (!service) return sendSpaShell(req, res, { status: 404, forceNoindex: true });

            const title = normalizeSingleLine(service.title) || 'Detalle del servicio';
            const providerName = normalizeSingleLine(service.provider_name);
            const description = normalizeSingleLine(service.description).slice(0, 160)
                || `Revisa el detalle y cobertura de este servicio${providerName ? ` ofrecido por ${providerName}` : ''}.`;

            return sendSpaShell(req, res, {
                overrides: {
                    title: `${title} | Servicios a tu Hogar`,
                    description,
                    image: getSafeImageUrl(getFirstImage(service.image_urls), siteOrigin)
                }
            });
        } catch (error) {
            return failLoader(res, next, error);
        }
    });

    router.get('/provider/:id', async (req, res, next) => {
        try {
            const provider = await loadPublicProviderSeo(db, req.params.id);
            if (!provider) return sendSpaShell(req, res, { status: 404, forceNoindex: true });

            const name = normalizeSingleLine(provider.name) || 'Proveedor';
            const description = normalizeSingleLine(provider.bio).slice(0, 160)
                || 'Conoce el perfil y los servicios de este profesional.';

            return sendSpaShell(req, res, {
                overrides: {
                    title: `${name} | Servicios a tu Hogar`,
                    description,
                    image: getSafeImageUrl(provider.profile_image_url, siteOrigin),
                    type: 'profile'
                }
            });
        } catch (error) {
            return failLoader(res, next, error);
        }
    });

    router.get('/legal/:slug', async (req, res, next) => {
        try {
            const policy = await loadPublicPolicySeo(db, req.params.slug);
            if (!policy) return sendSpaShell(req, res, { status: 404, forceNoindex: true });

            return sendSpaShell(req, res, {
                overrides: {
                    title: `${policy.title} | Servicios a tu Hogar`,
                    description: stripHtml(policy.content).slice(0, 160)
                        || `${policy.title} de la plataforma Servicios a tu Hogar.`
                }
            });
        } catch (error) {
            return failLoader(res, next, error);
        }
    });

    router.get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/api')) return next();

        if (path.extname(req.path)) {
            res.set('X-Robots-Tag', NOINDEX);
            return res.status(404).type('text').send('Asset not found');
        }

        if (!isKnownSpaRoute(req.path)) {
            return sendSpaShell(req, res, { status: 404, forceNoindex: true });
        }

        return sendSpaShell(req, res);
    });

    return router;
};

export default createSeoFrontendRouter;
