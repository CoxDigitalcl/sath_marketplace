import express from 'express';
import { getSettings } from '../controllers/adminController.js';

const router = express.Router();

// Allow public read access to platform settings (like legal_policies, social_media)
router.get('/settings/:group', (req, res, next) => {
    const { group } = req.params;
    const allowedPublicGroups = ['legal_policies', 'social_media', 'whatsapp'];

    if (!allowedPublicGroups.includes(group)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden access to this config group' });
    }

    getSettings(req, res, next);
});

router.post('/idea', async (req, res, next) => {
    try {
        const { ideaName, ideaEmail, ideaDesc } = req.body;
        
        if (!ideaName || !ideaDesc) {
            return res.status(400).json({ status: 'error', message: 'Name and Description are required' });
        }
        
        const { notifyAdmin, sendEmail } = await import('../services/notificationService.js');
        
        // 1. Notify Admin
        await notifyAdmin('SERVICE_IDEA', {
            name: ideaName,
            email: ideaEmail,
            desc: ideaDesc
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
                        <p>Te confirmamos que hemos recibido tu propuesta de servicio: <strong>${ideaName}</strong>.</p>
                        <p>Nuestro equipo está evaluando tu idea. Como te prometimos, si decidimos implementarla dentro de la plataforma, nos pondremos en contacto contigo para regalarte <strong>descuentos especiales</strong>.</p>
                        <p>Detalles de tu idea:</p>
                        <blockquote style="border-left: 4px solid #eee; margin: 0; padding-left: 10px; color: #555;">
                            ${ideaDesc}
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
