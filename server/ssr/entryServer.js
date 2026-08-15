import React from 'react';
import { renderToString } from 'react-dom/server';

import PublicSsrView from '../../shared/publicSsrView.js';

const ROOT_PLACEHOLDER = /<div\s+id=["']root["']\s*><\/div>/i;

const serializeForInlineScript = (value) => JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const renderPublicPage = (page) => ({
    markup: renderToString(React.createElement(PublicSsrView, { page })),
    stateScript: `<script>window.__PUBLIC_SSR__=${serializeForInlineScript(page)};</script>`
});

export const injectPublicSsr = (html, page) => {
    if (!ROOT_PLACEHOLDER.test(html)) {
        throw new Error('Frontend index is missing an empty #root SSR mount point');
    }

    const { markup, stateScript } = renderPublicPage(page);
    return html.replace(
        ROOT_PLACEHOLDER,
        `<div id="root">${markup}</div>${stateScript}`
    );
};

export default renderPublicPage;
