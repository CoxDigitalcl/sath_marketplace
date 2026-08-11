import axios from 'axios';
import logger from '../config/logger.js';
import { sendEmail } from './notificationService.js'; // Import Email Service

// Configuration
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ENV = process.env.NODE_ENV || 'development';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

export const SEVERITY = {
    CRITICAL: 'high',  // Red Code
    HIGH: 'high',
    WARNING: 'warning', // Orange
    INFO: 'info'       // Blue
};

/**
 * Sends a rich alert to Discord via Webhook.
 * @param {Error|String} error - The error object or message.
 * @param {Object} context - Additional metadata (e.g., req.path, user.id).
 * @param {String} severity - Level from SEVERITY enum.
 */
export const notify = async (error, context = {}, severity = SEVERITY.CRITICAL) => {
    // 1. Silent Log
    logger.error(`[ALERT] ${severity.toUpperCase()}: ${error.message || error}`, context);

    if (severity === SEVERITY.INFO || severity === SEVERITY.WARNING) {
        // Skip webhook for low severity to reduce noise, unless configured otherwise
        return;
    }

    try {
        const message = error.message || error.toString();
        const stack = error.stack ? error.stack.substring(0, 500) : 'No stack trace'; // Truncate stack

        // Discord Embed Color
        const color = severity === SEVERITY.CRITICAL ? 15548997 : 3447003; // Red or Blue

        const payload = {
            username: `SRE Bot - ${ENV.toUpperCase()}`,
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            embeds: [
                {
                    title: `🚨 ${severity.toUpperCase()} ALERT`,
                    description: `**Error:** ${message}`,
                    color: color,
                    fields: [
                        { name: "Context", value: `\`\`\`json\n${JSON.stringify(context, null, 2).substring(0, 1000)}\n\`\`\`` },
                        { name: "Stack Trace", value: `\`\`\`${stack}\n\`\`\`` }
                    ],
                    footer: {
                        text: `Serviciosatuhogar | ${new Date().toISOString()}`
                    }
                }
            ]
        };

        // ... Discord Payload construction ...

        // 2. Dispatch to Discord (Async)
        const discordPromise = WEBHOOK_URL ? axios.post(WEBHOOK_URL, payload) : Promise.resolve();

        // 3. Dispatch to Email (CRITICAL ONLY)
        let emailPromise = Promise.resolve();
        if (severity === SEVERITY.CRITICAL) {
            const emailHtml = `
                <h1 style="color:red">🚨 CRITICAL SYSTEM ALERT</h1>
                <p><strong>Error:</strong> ${message}</p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                <hr/>
                <h3>Context</h3>
                <pre>${JSON.stringify(context, null, 2)}</pre>
                <h3>Stack Trace</h3>
                <pre>${stack}</pre>
             `;
            emailPromise = sendEmail({
                to: ADMIN_EMAIL,
                subject: `[CRITICAL] ${message.substring(0, 50)}...`,
                html: emailHtml
            });
        }

        // Await all dispatches (fail safe)
        await Promise.allSettled([discordPromise, emailPromise]);

    } catch (sendError) {
        // ... error handling ...
        console.error('FAILED TO SEND DISCORD ALERT:', sendError.message);
        // Do not throw, finding out the alert failed shouldn't crash the app
    }
};

export default { notify, SEVERITY };
