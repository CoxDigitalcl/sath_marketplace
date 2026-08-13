import express from 'express';
import { getSettings } from '../controllers/adminController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const ideaLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
        status: 'error',
        message: 'Demasiadas ideas enviadas. Intenta nuevamente mas tarde.',
        code: 'IDEA_RATE_LIMITED'
    })
});

const normalizeSingleLine = (value) => (
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
);
const normalizeDescription = (value) => (typeof value === 'string' ? value.trim() : '');
const isValidEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = (value) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// Allow public read access to platform settings (like legal_policies, social_media)
router.get('/settings/:group', (req, res, next) => {
    const { group } = req.params;
    const allowedPublicGroups = ['legal_policies', 'social_media', 'whatsapp'];

    if (!allowedPublicGroups.includes(group)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden access to this config group' });
    }

    getSettings(req, res, next);
});

router.post('/idea', ideaLimiter, async (req, res, next) => {
    try {
        const ideaName = normalizeSingleLine(req.body?.ideaName);
        const ideaEmail = normalizeSingleLine(req.body?.ideaEmail).toLowerCase();
        const ideaDesc = normalizeDescription(req.body?.ideaDesc);
        const invalidIdea = (
            ideaName.length < 3 ||
            ideaName.length > 120 ||
            ideaDesc.length < 10 ||
            ideaDesc.length > 2000 ||
            !isValidEmail(ideaEmail)
        );
        if (invalidIdea) {
            return res.status(400).json({
                status: 'error',
                message: 'Revisa el nombre, la descripcion y el correo antes de enviar.',
                code: 'INVALID_IDEA_SUBMISSION'
            });
        }

        const safeIdeaName = escapeHtml(ideaName);
        const safeIdeaEmail = escapeHtml(ideaEmail);
        const safeIdeaDesc = escapeHtml(ideaDesc).replaceAll('\n', '<br>');

        
        if (!ideaName || !ideaDesc) {
            return res.status(400).json({ status: 'error', message: 'Name and Description are required' });
        }
        
        const { notifyAdmin, sendEmail } = await import('../services/notificationService.js');
        
        // 1. Notify Admin
        await notifyAdmin('SERVICE_IDEA', {
            name: safeIdeaName,
            email: safeIdeaEmail,
            desc: safeIdeaDesc
        });
        
        // 2. Notify User (if email provided)
        if (ideaEmail) {
            const userSubject = `¡Hemos recibido tu idea: ${ideaName}!`;
            const userHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <div style="background-color: #0d9488; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h2 style="color: #fff; margin: 0;">Servicios a tu Hogar</h2>
                    </div>
                    <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                        <h3 style="margin-top: 0;">¡Gracias por compartir tu idea con nosotros!</h3>
                        <p>Hola,</p>
                        <p>Te confirmamos que hemos recibido tu propuesta de servicio: <strong>${safeIdeaName}</strong>.</p>
                        <p>Nuestro equipo está evaluando tu idea. Como te prometimos, si decidimos implementarla dentro de la plataforma, nos pondremos en contacto contigo para regalarte <strong>descuentos especiales</strong>.</p>
                        <p>Detalles de tu idea:</p>
                        <blockquote style="border-left: 4px solid #eee; margin: 0; padding-left: 10px; color: #555;">
                            ${safeIdeaDesc}
                        </blockquote>
                        <br>
                        <p>¡Gracias por ayudarnos a mejorar!</p>
                        <p>Atentamente,<br>El Equipo de Servicios a tu Hogar</p>
                    </div>
                </div>
            `;
            // Fire and forget user email so it doesn't block response
            sendEmail({ to: ideaEmail, subject: userSubject, html: userHtml }).catch(e => console.error("Error sending user idea email", e));
        }
        
        res.json({ status: 'success', message: 'Idea submitted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
