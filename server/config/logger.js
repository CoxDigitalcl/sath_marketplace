import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SENSITIVE_KEY = /password|secret|token|authorization|cookie|email|rut|phone|payload|body|ip|address/i;

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

const redactString = (value) => String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]')
    .replace(/(bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/([?&](?:token|secret|code|key)=)[^&\s]+/gi, '$1[redacted]');

const sanitizeValue = (value, depth = 0) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactString(value).slice(0, 2000);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (depth >= 3) return '[truncated]';
    if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
    if (value instanceof Error) {
        return {
            name: value.name,
            code: typeof value.code === 'string' ? value.code.slice(0, 64) : undefined,
            message: redactString(value.message || 'Error').slice(0, 500),
        };
    }
    if (typeof value !== 'object') return redactString(value);

    return Object.fromEntries(
        Object.entries(value)
            .slice(0, 50)
            .filter(([key]) => !SENSITIVE_KEY.test(key))
            .map(([key, entry]) => [key, sanitizeValue(entry, depth + 1)])
    );
};

const sanitizeLogFormat = winston.format((info) => {
    for (const key of Object.keys(info)) {
        if (SENSITIVE_KEY.test(key)) {
            delete info[key];
        } else {
            info[key] = sanitizeValue(info[key]);
        }
    }
    return info;
});

const productionFormat = winston.format.combine(
    winston.format.errors({ stack: true }),
    sanitizeLogFormat(),
    winston.format.timestamp(),
    winston.format.json()
);

const developmentFormat = winston.format.combine(
    sanitizeLogFormat(),
    winston.format.colorize({ all: true }),
    winston.format.simple()
);

const positiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveLogDirectory = (candidate) => {
    if (!candidate) return path.join(projectRoot, 'logs');
    return path.isAbsolute(candidate) ? candidate : path.resolve(projectRoot, candidate);
};

export const createApplicationLogger = ({
    environment = process.env.NODE_ENV || 'development',
    logDirectory = process.env.LOG_DIR,
    fileEnabled = process.env.LOG_FILE_ENABLED !== 'false',
    consoleEnabled = true,
    maxSizeBytes = positiveInteger(process.env.LOG_MAX_SIZE_BYTES, 5 * 1024 * 1024),
    maxFiles = positiveInteger(process.env.LOG_MAX_FILES, 5),
} = {}) => {
    const transports = [];
    const isProduction = environment === 'production';

    if (consoleEnabled) {
        transports.push(new winston.transports.Console({
            format: isProduction ? productionFormat : developmentFormat,
        }));
    }

    if (isProduction && fileEnabled) {
        try {
            const directory = resolveLogDirectory(logDirectory);
            fs.mkdirSync(directory, { recursive: true });
            const fileOptions = {
                maxsize: positiveInteger(maxSizeBytes, 5 * 1024 * 1024),
                maxFiles: positiveInteger(maxFiles, 5),
                tailable: true,
                format: productionFormat,
            };
            transports.push(new winston.transports.File({
                ...fileOptions,
                filename: path.join(directory, 'application.log'),
            }));
            transports.push(new winston.transports.File({
                ...fileOptions,
                filename: path.join(directory, 'error.log'),
                level: 'error',
            }));
        } catch (error) {
            process.stderr.write(`Persistent logging disabled: ${error?.code || 'LOG_DIRECTORY_UNAVAILABLE'}\n`);
        }
    }

    if (transports.length === 0) {
        transports.push(new winston.transports.Console({ format: productionFormat }));
    }

    return winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        levels,
        format: productionFormat,
        transports,
        exitOnError: false,
    });
};

const logger = createApplicationLogger();

export default logger;
