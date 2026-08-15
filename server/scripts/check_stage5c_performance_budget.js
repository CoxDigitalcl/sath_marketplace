import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..', '..');
const distPath = path.join(projectRoot, 'dist');

const BUDGETS = Object.freeze({
    initialJavaScriptGzipBytes: 180 * 1024,
    initialCssGzipBytes: 20 * 1024,
    routeChunkGzipBytes: 150 * 1024,
    individualVideoBytes: 6 * 1024 * 1024,
    totalVideoBytes: 10 * 1024 * 1024
});

const requiredVideos = Object.freeze([
    'videos/Video-clientes.mp4',
    'videos/Video-proveedores.mp4'
]);

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const gzipSize = (filePath) => zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).length;
const toDistPath = (assetUrl) => path.join(distPath, assetUrl.replace(/^\//, ''));

if (!fs.existsSync(path.join(distPath, 'index.html'))) {
    throw new Error('dist/index.html no existe. Ejecuta npm run build antes del presupuesto 5C.');
}

const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
const initialJavaScript = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/gi)]
    .map((match) => match[1]);
const initialCss = [...indexHtml.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+\.css)["']/gi)]
    .map((match) => match[1]);

if (initialJavaScript.length === 0) {
    throw new Error('No se encontró el JavaScript inicial en dist/index.html.');
}

const initialJavaScriptGzip = initialJavaScript
    .map(toDistPath)
    .reduce((total, filePath) => total + gzipSize(filePath), 0);
const initialCssGzip = initialCss
    .map(toDistPath)
    .reduce((total, filePath) => total + gzipSize(filePath), 0);

const initialAssetNames = new Set(initialJavaScript.map((assetUrl) => path.basename(assetUrl)));
const routeChunks = fs.readdirSync(path.join(distPath, 'assets'))
    .filter((fileName) => fileName.endsWith('.js') && !initialAssetNames.has(fileName))
    .map((fileName) => ({
        fileName,
        gzipBytes: gzipSize(path.join(distPath, 'assets', fileName))
    }))
    .sort((left, right) => right.gzipBytes - left.gzipBytes);

const videoMetrics = requiredVideos.map((relativePath) => {
    const filePath = path.join(distPath, relativePath);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Falta el medio obligatorio en el build: ${relativePath}`);
    }
    return {
        relativePath,
        bytes: fs.statSync(filePath).size
    };
});
const totalVideoBytes = videoMetrics.reduce((total, metric) => total + metric.bytes, 0);

const failures = [];
if (initialJavaScriptGzip > BUDGETS.initialJavaScriptGzipBytes) {
    failures.push(`JS inicial: ${formatBytes(initialJavaScriptGzip)} > ${formatBytes(BUDGETS.initialJavaScriptGzipBytes)}`);
}
if (initialCssGzip > BUDGETS.initialCssGzipBytes) {
    failures.push(`CSS inicial: ${formatBytes(initialCssGzip)} > ${formatBytes(BUDGETS.initialCssGzipBytes)}`);
}
for (const chunk of routeChunks) {
    if (chunk.gzipBytes > BUDGETS.routeChunkGzipBytes) {
        failures.push(`Chunk ${chunk.fileName}: ${formatBytes(chunk.gzipBytes)} > ${formatBytes(BUDGETS.routeChunkGzipBytes)}`);
    }
}
for (const video of videoMetrics) {
    if (video.bytes > BUDGETS.individualVideoBytes) {
        failures.push(`${video.relativePath}: ${formatBytes(video.bytes)} > ${formatBytes(BUDGETS.individualVideoBytes)}`);
    }
}
if (totalVideoBytes > BUDGETS.totalVideoBytes) {
    failures.push(`Videos combinados: ${formatBytes(totalVideoBytes)} > ${formatBytes(BUDGETS.totalVideoBytes)}`);
}

console.log('Presupuesto 5C');
console.log(`- JS inicial gzip: ${formatBytes(initialJavaScriptGzip)} / ${formatBytes(BUDGETS.initialJavaScriptGzipBytes)}`);
console.log(`- CSS inicial gzip: ${formatBytes(initialCssGzip)} / ${formatBytes(BUDGETS.initialCssGzipBytes)}`);
console.log(`- Chunk mayor gzip: ${routeChunks[0]?.fileName || 'ninguno'} ${formatBytes(routeChunks[0]?.gzipBytes || 0)} / ${formatBytes(BUDGETS.routeChunkGzipBytes)}`);
for (const video of videoMetrics) {
    console.log(`- ${video.relativePath}: ${formatBytes(video.bytes)} / ${formatBytes(BUDGETS.individualVideoBytes)}`);
}
console.log(`- Videos combinados: ${formatBytes(totalVideoBytes)} / ${formatBytes(BUDGETS.totalVideoBytes)}`);

if (failures.length > 0) {
    console.error('Presupuesto 5C excedido:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log('Presupuesto 5C aprobado.');
}
