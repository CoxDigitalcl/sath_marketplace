import helmet from 'helmet';
import cors from 'cors';
import { getCorsOrigins, normalizeOrigin } from '../config/application.js';

export const createCorsOptions = (environment = process.env) => {
    const allowedOrigins = new Set(getCorsOrigins(environment));

    return {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            return callback(null, allowedOrigins.has(normalizeOrigin(origin)));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
};

const securitySetup = (app, environment = process.env) => {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://app.payku.cl"],
                frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://player.vimeo.com"],
                mediaSrc: ["'self'", "blob:", "data:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    }));

    app.use(cors(createCorsOptions(environment)));
};

export default securitySetup;
