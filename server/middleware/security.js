import helmet from 'helmet';
import cors from 'cors';

const securitySetup = (app) => {
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

    const corsOptions = {
        origin: process.env.CORS_ORIGIN || 'https://serviciosatuhogar.cl',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };

    app.use(cors(corsOptions));
};

export default securitySetup;
