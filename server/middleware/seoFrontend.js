import express from 'express';
import fs from 'fs';
import path from 'path';

import { createSeoFrontendRouter as createLegacySeoFrontendRouter } from './seoFrontend.legacy.js';
import {
    SEO_CACHE_HEADERS,
    getRouteSeo,
    injectSeoMetadata,
} from '../services/seoService.js';

export const createSeoFrontendRouter = (options = {}) => {
    const { buildPath, indexHtml } = options;
    const router = express.Router();

    const loadIndexHtml = () => {
        if (typeof indexHtml === 'string') return indexHtml;
        if (!buildPath) throw new Error('buildPath or indexHtml is required to serve the frontend');
        return fs.readFileSync(path.join(buildPath, 'index.html'), 'utf8');
    };

    const sendPrivateProviderShell = (req, res) => {
        let html;
        try {
            html = loadIndexHtml();
        } catch {
            return res.status(500).send('Error loading frontend');
        }

        const seo = getRouteSeo({ pathname: req.path, query: req.query });
        res.status(200);
        res.set('Cache-Control', SEO_CACHE_HEADERS.html);
        res.set('X-Robots-Tag', seo.robots);
        return res.type('html').send(injectSeoMetadata(html, seo));
    };

    // Express would otherwise match these private paths as /provider/:id and
    // query the public provider loader before the SPA catch-all can noindex them.
    router.get('/provider/dashboard', sendPrivateProviderShell);
    router.get('/provider/register', sendPrivateProviderShell);
    router.use(createLegacySeoFrontendRouter(options));

    return router;
};

export default createSeoFrontendRouter;
