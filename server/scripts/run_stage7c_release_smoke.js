import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 15_000;
const NORMAL_USER_AGENT = 'SATH-Stage7C-Smoke/1.0';
const CRAWLER_USER_AGENT = 'Googlebot/2.1 (+https://www.google.com/bot.html)';

const requiredSecurityHeaders = [
    ['content-security-policy', /default-src\s+'self'/i],
    ['strict-transport-security', /max-age=/i],
    ['x-content-type-options', /^nosniff$/i],
    ['referrer-policy', /strict-origin-when-cross-origin/i],
];

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const readPublicPageContract = (body) => {
    const h1Match = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const canonicalTag = body.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i)?.[0] || '';
    const canonicalMatch = canonicalTag.match(/\bhref=["']([^"']+)["']/i);
    return {
        h1: (h1Match?.[1] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        canonical: (canonicalMatch?.[1] || '').trim(),
    };
};

export const normalizeStage7cBaseUrl = (candidate, { allowLocalHttp = false } = {}) => {
    const raw = String(candidate || '').trim();
    assert(raw, 'STAGE7C_BASE_URL is required');

    const url = new URL(raw);
    const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    assert(url.protocol === 'https:' || (allowLocalHttp && localHost && url.protocol === 'http:'), 'Smoke target must use HTTPS');
    assert(!url.username && !url.password, 'Smoke target must not contain credentials');
    assert(!url.search && !url.hash, 'Smoke target must not contain query parameters or fragments');

    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url;
};

const request = async ({ baseUrl, pathname, userAgent, fetchImpl, timeoutMs }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
        const url = new URL(pathname, baseUrl);
        const response = await fetchImpl(url, {
            method: 'GET',
            headers: {
                accept: pathname.startsWith('/api/') ? 'application/json' : '*/*',
                'user-agent': userAgent,
            },
            redirect: 'manual',
            signal: controller.signal,
        });
        const body = await response.text();
        return {
            body,
            durationMs: Date.now() - startedAt,
            headers: response.headers,
            pathname,
            status: response.status,
        };
    } finally {
        clearTimeout(timer);
    }
};

const assertSecurityHeaders = ({ headers, pathname }) => {
    for (const [name, pattern] of requiredSecurityHeaders) {
        const value = headers.get(name) || '';
        assert(pattern.test(value), `${pathname}: missing or invalid ${name}`);
    }
};

const check = async (name, operation) => {
    const startedAt = Date.now();
    try {
        const result = await operation();
        return {
            name,
            ok: true,
            status: result?.status,
            durationMs: result?.durationMs ?? (Date.now() - startedAt),
        };
    } catch (error) {
        return {
            name,
            ok: false,
            durationMs: Date.now() - startedAt,
            error: String(error?.message || error).slice(0, 240),
        };
    }
};

export const runStage7cReleaseSmoke = async ({
    baseUrl: candidate,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    allowLocalHttp = false,
} = {}) => {
    assert(typeof fetchImpl === 'function', 'A fetch implementation is required');
    assert(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 60_000, 'Timeout must be between 1000 and 60000 ms');

    const baseUrl = normalizeStage7cBaseUrl(candidate, { allowLocalHttp });
    const runRequest = (pathname, userAgent = NORMAL_USER_AGENT) => request({
        baseUrl,
        pathname,
        userAgent,
        fetchImpl,
        timeoutMs,
    });

    let homepageContract;
    const checks = [];
    checks.push(await check('health_db', async () => {
        const response = await runRequest('/api/health');
        assert(response.status === 200, `/api/health returned ${response.status}`);
        assert(/^application\/json\b/i.test(response.headers.get('content-type') || ''), '/api/health is not JSON');
        const data = JSON.parse(response.body);
        assert(data.status === 'ok', '/api/health status is not ok');
        assert(data.db_connection === 'connected', '/api/health database is not connected');
        assertSecurityHeaders(response);
        return response;
    }));

    checks.push(await check('homepage_ssr', async () => {
        const response = await runRequest('/');
        assert(response.status === 200, `/ returned ${response.status}`);
        assert(/^text\/html\b/i.test(response.headers.get('content-type') || ''), '/ is not HTML');
        homepageContract = readPublicPageContract(response.body);
        assert(homepageContract.h1, '/ does not contain a server-rendered H1');
        assert(homepageContract.canonical, '/ does not contain a canonical link');
        assert((response.headers.get('x-robots-tag') || '').toLowerCase() === 'index, follow', '/ is not indexable');
        assertSecurityHeaders(response);
        return response;
    }));

    checks.push(await check('crawler_parity', async () => {
        const response = await runRequest('/', CRAWLER_USER_AGENT);
        assert(response.status === 200, `crawler / returned ${response.status}`);
        const crawlerContract = readPublicPageContract(response.body);
        assert(crawlerContract.h1, 'crawler / does not contain a server-rendered H1');
        assert(crawlerContract.canonical, 'crawler / does not contain a canonical link');
        assert((response.headers.get('x-robots-tag') || '').toLowerCase() === 'index, follow', 'crawler / is not indexable');
        assert(crawlerContract.h1 === homepageContract?.h1, 'crawler / H1 differs from the browser response');
        assert(crawlerContract.canonical === homepageContract?.canonical, 'crawler / canonical differs from the browser response');
        return response;
    }));

    checks.push(await check('robots', async () => {
        const response = await runRequest('/robots.txt');
        assert(response.status === 200, `/robots.txt returned ${response.status}`);
        assert(/^text\/plain\b/i.test(response.headers.get('content-type') || ''), '/robots.txt is not text/plain');
        assert(/^\s*Sitemap:\s+https:\/\//im.test(response.body), '/robots.txt does not advertise an HTTPS sitemap');
        return response;
    }));

    checks.push(await check('sitemap', async () => {
        const response = await runRequest('/sitemap.xml');
        assert(response.status === 200, `/sitemap.xml returned ${response.status}`);
        assert(/^(application|text)\/xml\b/i.test(response.headers.get('content-type') || ''), '/sitemap.xml is not XML');
        assert(/<urlset\b/i.test(response.body), '/sitemap.xml does not contain a urlset');
        assert(!/<loc>[^<]*(?:\/login|\/admin|\/checkout|\/search)[^<]*<\/loc>/i.test(response.body), '/sitemap.xml contains a private route');
        return response;
    }));

    checks.push(await check('private_noindex', async () => {
        const response = await runRequest('/login');
        assert(response.status === 200, `/login returned ${response.status}`);
        assert((response.headers.get('x-robots-tag') || '').toLowerCase() === 'noindex, nofollow, noarchive', '/login is not fully noindex');
        assert(!/<link\s+rel=["']canonical["']/i.test(response.body), '/login must not contain a canonical link');
        return response;
    }));

    checks.push(await check('honest_404', async () => {
        const response = await runRequest('/__stage7c_smoke_not_found__');
        assert(response.status === 404, `unknown route returned ${response.status}`);
        assert((response.headers.get('x-robots-tag') || '').toLowerCase() === 'noindex, nofollow, noarchive', '404 is not fully noindex');
        assert(!/<link\s+rel=["']canonical["']/i.test(response.body), '404 must not contain a canonical link');
        return response;
    }));

    return {
        ok: checks.every(({ ok }) => ok),
        targetOrigin: baseUrl.origin,
        checks,
    };
};

const runFromCli = async () => {
    const result = await runStage7cReleaseSmoke({
        baseUrl: process.env.STAGE7C_BASE_URL,
        timeoutMs: Number.parseInt(process.env.STAGE7C_TIMEOUT_MS || '', 10) || DEFAULT_TIMEOUT_MS,
        allowLocalHttp: process.env.STAGE7C_ALLOW_HTTP_LOCAL === 'true',
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runFromCli().catch((error) => {
        console.error(JSON.stringify({ ok: false, error: String(error?.message || error).slice(0, 240) }));
        process.exitCode = 1;
    });
}
