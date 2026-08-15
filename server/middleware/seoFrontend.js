import express from 'express';
import fs from 'fs';
import path from 'path';

import logger from '../config/logger.js';
import {
    SEO_CACHE_HEADERS,
    buildRobotsTxt,
    buildSitemapXml,
    getRouteSeo,
    getSiteOrigin,
    injectSeoMetadata
} from '../services/seoService.js';
import {
    createSsrFailurePage,
    loadPublicRouteDocument,
    loadPublicSitemapPaths,
    resolveApplicationRoute
} from '../services/publicRouteManifest.js';
import { injectPublicSsr } from '../ssr/entryServer.js';

const NOINDEX = 'noindex, nofollow, noarchive';
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg']);
const VIDEO_CACHE_CONTROL = 'public, max-age=86400';

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

    const sendSpaShell = (req, res, {
        status = 200,
        overrides = {},
        forceNoindex = false,
        ssrPage = null
    } = {}) => {
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

        try {
            html = injectSeoMetadata(html, seo);
            if (ssrPage) html = injectPublicSsr(html, ssrPage);
        } catch (error) {
            logger.error('Public SSR HTML rendering failed.', {
                path: req.path,
                correlationId: req.correlationId,
                errorType: error?.name || 'Error'
            });
            return res.status(500)
                .set('Cache-Control', SEO_CACHE_HEADERS.html)
                .set('X-Robots-Tag', NOINDEX)
                .type('html')
                .send('Error rendering frontend');
        }

        res.status(status);
        res.set('Cache-Control', SEO_CACHE_HEADERS.html);
        res.set('X-Robots-Tag', seo.robots);
        return res.type('html').send(html);
    };

    const sendSsrFailure = (req, res) => {
        res.set('Retry-After', '30');
        return sendSpaShell(req, res, {
            status: 503,
            forceNoindex: true,
            overrides: {
                title: 'Contenido temporalmente no disponible | Servicios a tu Hogar',
                description: 'El contenido público no está disponible temporalmente.',
                canonical: null
            },
            ssrPage: createSsrFailurePage()
        });
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
            res.set('X-Robots-Tag', NOINDEX);
            return next(error);
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
                } else if (VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
                    res.setHeader('Cache-Control', VIDEO_CACHE_CONTROL);
                }
            }
        }));
    }

    router.get(/.*/, async (req, res, next) => {
        if (req.path.startsWith('/api')) return next();

        if (path.extname(req.path)) {
            res.set('X-Robots-Tag', NOINDEX);
            return res.status(404).type('text').send('Asset not found');
        }

        const resolved = resolveApplicationRoute(req.path);
        if (!resolved) {
            return sendSpaShell(req, res, { status: 404, forceNoindex: true });
        }

        if (resolved.definition.renderMode !== 'ssr') {
            return sendSpaShell(req, res);
        }

        try {
            const document = await loadPublicRouteDocument({ db, pathname: req.path });
            if (!document || document.status === 404) {
                return sendSpaShell(req, res, { status: 404, forceNoindex: true });
            }

            if (document.redirectTo && [301, 308].includes(document.status)) {
                res.set('Cache-Control', SEO_CACHE_HEADERS.discovery);
                return res.redirect(document.status, new URL(document.redirectTo, siteOrigin).toString());
            }

            return sendSpaShell(req, res, {
                status: document.status,
                overrides: document.seo,
                ssrPage: document.page
            });
        } catch (error) {
            logger.error('Public SSR loader failed.', {
                path: req.path,
                correlationId: req.correlationId,
                errorType: error?.name || 'Error',
                errorCode: error?.code || 'SSR_LOADER_FAILURE'
            });
            return sendSsrFailure(req, res);
        }
    });

    return router;
};

export default createSeoFrontendRouter;
