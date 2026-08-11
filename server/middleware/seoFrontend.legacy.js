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

const getSafeImageUrl = (candidate, siteOrigin) => {
    if (!candidate) return undefined;

    try {
        const parsed = new URL(candidate, siteOrigin);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
    } catch {
        return undefined;
    }
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
            return res.status(500).send('Error loading frontend');
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

    // Discovery resources must never fall through to the SPA shell.
    router.get('/robots.txt', (req, res) => {
        res.set('Cache-Control', SEO_CACHE_HEADERS.discovery);
        res.type('text/plain').send(buildRobotsTxt(siteOrigin));
    });

    router.get('/sitemap.xml', (req, res) => {
        res.set('Cache-Control', SEO_CACHE_HEADERS.discovery);
        res.type('application/xml').send(buildSitemapXml(siteOrigin));
    });

    if (buildPath) {
        // Vite content-hashed bundles are safe to cache immutably. Root files are
        // deliberately short-lived and index.html is handled by sendSpaShell.
        router.use('/assets', express.static(path.join(buildPath, 'assets'), {
            immutable: true,
            maxAge: '1y'
        }));
        router.use(express.static(buildPath, {
            index: false,
            maxAge: '1h'
        }));
    }

    // Metadata injection only: visible profile content is still client-rendered.
    router.get('/provider/:id', async (req, res, next) => {
        if (!isKnownSpaRoute(req.path)) {
            return sendSpaShell(req, res, { status: 404, forceNoindex: true });
        }

        if (!db?.pool?.query) {
            return sendSpaShell(req, res);
        }

        try {
            const result = await db.pool.query(`
                SELECT
                    COALESCE(pp.full_name, pp.store_name, 'Proveedor') as name,
                    pp.bio,
                    pp.profile_image_url
                FROM provider_profiles pp
                JOIN users u ON u.id = pp.user_id
                WHERE pp.user_id = $1
                  AND u.role = 'provider'
                  AND u.is_verified = TRUE
                  AND COALESCE(u.is_blocked, FALSE) = FALSE
                LIMIT 1
            `, [req.params.id]);

            if (!result.rows.length) {
                return sendSpaShell(req, res, { status: 404, forceNoindex: true });
            }

            const provider = result.rows[0];
            const normalizedBio = `${provider.bio || ''}`.replace(/\s+/g, ' ').trim();
            const overrides = {
                title: `${provider.name} | Servicios a tu Hogar`,
                description: normalizedBio.slice(0, 160) || 'Conoce el perfil y los servicios de este profesional.',
                image: getSafeImageUrl(provider.profile_image_url, siteOrigin),
                type: 'profile'
            };

            return sendSpaShell(req, res, { overrides });
        } catch (error) {
            return next(error);
        }
    });

    router.get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/api')) return next();

        if (path.extname(req.path)) {
            res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
            return res.status(404).type('text').send('Asset not found');
        }

        // BrowserRouter receives its shell for known client routes. Unknown paths
        // receive the same shell for graceful rendering, but with a real 404 and
        // noindex so they cannot become duplicate home pages in search.
        if (!isKnownSpaRoute(req.path)) {
            return sendSpaShell(req, res, { status: 404, forceNoindex: true });
        }

        return sendSpaShell(req, res);
    });

    return router;
};

export default createSeoFrontendRouter;

