import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const textExtensions = new Set([
    '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs',
    '.sql', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

const patterns = [
    { name: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
    { name: 'GitHub token', regex: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/ },
    { name: 'AWS access key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
    { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
    { name: 'Stripe live secret', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
];

function trackedFiles() {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
        .split('\0')
        .filter(Boolean);
}

const findings = [];

for (const file of trackedFiles()) {
    const extensionIndex = file.lastIndexOf('.');
    const extension = extensionIndex >= 0 ? file.slice(extensionIndex).toLowerCase() : '';
    if (!textExtensions.has(extension)) continue;

    if (!fs.existsSync(file)) continue;

    const stats = fs.statSync(file);
    if (stats.size > 2 * 1024 * 1024) continue;

    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
        if (pattern.regex.test(content)) {
            findings.push(`${file}: posible ${pattern.name}`);
        }
    }
}

if (findings.length > 0) {
    console.error('Secret scan failed:');
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
} else {
    console.log('Secret scan passed: no known high-confidence token patterns found.');
}
