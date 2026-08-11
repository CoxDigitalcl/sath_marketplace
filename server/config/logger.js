import winston from 'winston';

// Console-Only Logger for cPanel Stability
// We avoid writing to files (logs/error.log) because directory permissions 
// often cause 503 crashes on startup if the folder doesn't exist.

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

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.json()
);

const transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.simple()
        ),
    })
];

const logger = winston.createLogger({
    level: 'info',
    levels,
    format,
    transports,
});

export default logger;
