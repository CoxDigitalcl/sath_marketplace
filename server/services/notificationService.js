import nodemailer from 'nodemailer';
import logger from '../config/logger.js';
import { pool } from '../config/db.js';

// Create Transporter
// On cPanel, if no SMTP vars are set, we can try using the local sendmail
let smtpConfigLogged = false;
const createTransporter = () => {
    if (process.env.SMTP_HOST) {
        if (!smtpConfigLogged) {
            logger.info(`[SMTP Config] Host: ${process.env.SMTP_HOST} | Port: ${process.env.SMTP_PORT || 465} | User: ${process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 5) + '***' : 'NOT SET'} | Pass: ${process.env.SMTP_PASS ? '***SET***' : 'NOT SET'}`);
            smtpConfigLogged = true;
        }
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 465,
            secure: (parseInt(process.env.SMTP_PORT) || 465) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        if (!smtpConfigLogged) {
            logger.warn(`[SMTP Config] No SMTP_HOST set. Falling back to sendmail. Emails may not send from this environment.`);
            smtpConfigLogged = true;
        }
        // Fallback or Local Dev
        return nodemailer.createTransport({
            sendmail: true,
            newline: 'unix',
            path: '/usr/sbin/sendmail',
        });
    }
};

export const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = createTransporter();
        
        let from = process.env.MAIL_FROM || '"Serviciosatuhogar" <no-reply@serviciosatuhogar.cl>';
        
        // Fix for cPanel vars: If user sets purely the name without email (e.g. "Comunicados"), wrap it
        if (from && !from.includes('<') && process.env.SMTP_USER) {
            from = `"${from}" <${process.env.SMTP_USER}>`;
        }

        logger.info(`[EMAIL] Attempting to send to: ${to} | Subject: ${subject} | From: ${from}`);

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
        });

        logger.info(`[EMAIL SENT] To: ${to} | ID: ${info.messageId} | Accepted: ${JSON.stringify(info.accepted)} | Rejected: ${JSON.stringify(info.rejected)}`);
        return true;
    } catch (error) {
        logger.error(`[EMAIL ERROR] To: ${to} | Subject: ${subject} | Error: ${error.message} | Code: ${error.code || 'N/A'} | Command: ${error.command || 'N/A'}`);
        logger.error(`[EMAIL ERROR STACK] ${error.stack}`);
        // Don't throw, just return false so we don't crash main flow
        return false;
    }
};


export const notifyAdmin = async (event, data) => {
    try {
        // Fetch Admin Email from Settings or Env
        // Using pool to check system_settings if implemented, else fallback
        // For Critical Alerts, AlertService passes the email directly, so this method 
        // might be used for other business logic notifications (like KYC upload)

        let adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        try {
            // Attempt to fetch from platform_settings first
            const res = await pool.query("SELECT value FROM platform_settings WHERE key = 'admin_email'");
            if (res.rows.length > 0) adminEmail = res.rows[0].value;
        } catch (dbErr) {
            // Fallback to .env if table doesn't exist yet
            logger.warn('Could not fetch admin_email from DB; using configured fallback.');
        }

        let subject = '';
        let html = '';

        switch (event) {
            case 'KYC_UPLOADED':
                subject = `[KYC] Nuevos documentos de ${data.providerName}`;
                html = `
                    <h3>Documentos Subidos</h3>
                    <p>El proveedor <strong>${data.providerName}</strong> (${data.email}) ha subido nuevos documentos.</p>
                    <p>Estado: <span style="color:orange">En Revisión</span></p>
                    <a href="${process.env.APP_URL || process.env.FRONTEND_URL || 'https://serviciosatuhogar.cl'}/admin/providers">Ir al Panel de Admin</a>
                `;
                break;
            case 'SERVICE_IDEA':
                subject = `[Idea] Nueva Idea de Servicio: ${data.name}`;
                html = `
                    <h3>Nueva Idea de Servicio</h3>
                    <p><strong>Nombre de la idea:</strong> ${data.name}</p>
                    <p><strong>Email del usuario:</strong> ${data.email || 'No proporcionado'}</p>
                    <p><strong>Descripción:</strong><br/>${data.desc}</p>
                `;
                break;
            default:
                subject = `[System] Notificación: ${event}`;
                html = `<p>${JSON.stringify(data)}</p>`;
        }

        await sendEmail({ to: adminEmail, subject, html });

    } catch (error) {
        logger.error(`Notify Admin Error: ${error.message}`);
    }
};

/**
 * Send Invoice Email to Client
 * @param {string} to - Client Email
 * @param {object} bookingDetails - { id, amount, serviceName }
 * @param {string} invoiceUrl - Link to PDF
 */
export const sendInvoiceEmail = async (to, bookingDetails, invoiceUrl) => {
    const subject = `Tu Boleta de Serviciosatuhogar - Reserva #${bookingDetails.id.slice(0, 8)}`;

    // Simple HTML Template
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #fca5a5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="color: #fff; margin: 0;">Serviciosatuhogar</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                <h3 style="margin-top: 0;">¡Gracias por tu pago!</h3>
                <p>Hola,</p>
                <p>Te confirmamos que el pago de tu servicio ha sido procesado exitosamente y adjuntamos tu <strong>Boleta Electrónica</strong>.</p>
                
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 4px 0;"><strong>Servicio:</strong> ${bookingDetails.serviceName}</p>
                    <p style="margin: 4px 0;"><strong>Monto:</strong> $${bookingDetails.amount.toLocaleString('es-CL')}</p>
                    <p style="margin: 4px 0;"><strong>Orden:</strong> #${bookingDetails.id}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${invoiceUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Descargar Boleta PDF
                    </a>
                </div>

                <p style="font-size: 14px; color: #666;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${invoiceUrl}">${invoiceUrl}</a>
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                <p style="text-align: center; font-size: 12px; color: #999;">
                    Este es un mensaje automático, por favor no respondas a este correo.
                </p>
            </div>
        </div>
    `;

    return sendEmail({ to, subject, html });
};

export const sendCrossContactEmails = async ({ bookingId, serviceName, client, provider, booking = {} }) => {
    // Format booking details if available
    const scheduledDate = booking.scheduled_date ? new Date(booking.scheduled_date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const scheduledTime = booking.selected_times ? (Array.isArray(booking.selected_times) ? booking.selected_times.join(', ') : booking.selected_times) : '';
    const amount = booking.amount ? `$${Number(booking.amount).toLocaleString('es-CL')}` : '';

    const bookingDetailsHtml = `
        <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #2e7d32;">Detalles de la Reserva</p>
            <p style="margin: 4px 0;"><strong>Servicio:</strong> ${serviceName}</p>
            ${scheduledDate ? `<p style="margin: 4px 0;"><strong>Fecha:</strong> ${scheduledDate}</p>` : ''}
            ${scheduledTime ? `<p style="margin: 4px 0;"><strong>Horario:</strong> ${scheduledTime}</p>` : ''}
            ${amount ? `<p style="margin: 4px 0;"><strong>Monto:</strong> ${amount}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Orden:</strong> #${bookingId}</p>
        </div>
    `;

    // 1. Email to Client
    const clientSubject = `Contacto del Proveedor - Reserva #${bookingId}`;
    const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #fca5a5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="color: #fff; margin: 0;">Serviciosatuhogar</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                <h3 style="margin-top: 0;">¡Datos de contacto listos!</h3>
                <p>Hola ${client.name},</p>
                <p>Como tu pago ha sido ingresado correctamente (en custodia), hemos liberado los datos de contacto directo de tu proveedor.</p>
                ${bookingDetailsHtml}
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Datos del Proveedor</p>
                    <p style="margin: 4px 0;"><strong>Nombre:</strong> ${provider.name}</p>
                    <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${provider.phone}</p>
                    <p style="margin: 4px 0;"><strong>Email:</strong> ${provider.email}</p>
                </div>
                <p>¡Ponte en contacto para afinar los detalles del servicio!</p>
            </div>
        </div>
    `;

    // 2. Email to Provider
    const providerSubject = `¡Nueva Reserva Confirmada! - Reserva #${bookingId}`;
    const providerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #fca5a5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="color: #fff; margin: 0;">Serviciosatuhogar</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                <h3 style="margin-top: 0;">Tienes un nuevo cliente</h3>
                <p>Hola ${provider.name},</p>
                <p>Han contratado tu servicio. El pago ya se encuentra en custodia segura.</p>
                ${bookingDetailsHtml}
                <p>A continuación, los datos de tu cliente para coordinar el trabajo:</p>
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 4px 0;"><strong>Cliente:</strong> ${client.name}</p>
                    <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${client.phone}</p>
                    <p style="margin: 4px 0;"><strong>Email:</strong> ${client.email}</p>
                </div>
                <p>Recuerda mantener una buena comunicación para asegurar una excelente reseña.</p>
            </div>
        </div>
    `;

    await sendEmail({ to: client.email, subject: clientSubject, html: clientHtml });
    await sendEmail({ to: provider.email, subject: providerSubject, html: providerHtml });
};

/**
 * Send a complete booking confirmation email to GUEST users.
 * This is critical because guest users have NO access to the platform dashboard.
 * This email is their ONLY record of the transaction, so it must include everything:
 * - Service details (name, date, time)
 * - Provider contact info (name, phone, email)
 * - Payment amount and order ID
 * - Escrow guarantee explanation
 * - CTA to register for future benefits
 */
export const sendGuestBookingConfirmation = async ({ bookingId, serviceName, guest, provider, booking = {} }) => {
    const scheduledDate = booking.scheduled_date ? new Date(booking.scheduled_date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Por confirmar';
    const scheduledTime = booking.selected_times ? (Array.isArray(booking.selected_times) ? booking.selected_times.join(', ') : booking.selected_times) : '';
    const amount = booking.amount ? `$${Number(booking.amount).toLocaleString('es-CL')}` : '';
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://serviciosatuhogar.cl';

    const subject = `Tu Reserva Confirmada - #${bookingId} | Serviciosatuhogar`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; background-color: #f9fafb;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c, #f97316); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Serviciosatuhogar</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Tu servicio ha sido contratado con éxito</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 30px 24px; background: #fff; border: 1px solid #eee; border-top: none;">
                <h2 style="margin-top: 0; color: #111;">¡Hola ${guest.name}!</h2>
                <p style="font-size: 16px; line-height: 1.6;">Tu pago ha sido procesado correctamente y está <strong>seguro en custodia</strong>. A continuación encontrarás toda la información que necesitas.</p>

                <!-- Booking Details Card -->
                <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 16px;">📋 Detalles de tu Reserva</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 6px 0; color: #666; width: 120px;">Servicio:</td><td style="padding: 6px 0; font-weight: bold;">${serviceName}</td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Fecha:</td><td style="padding: 6px 0; font-weight: bold;">${scheduledDate}</td></tr>
                        ${scheduledTime ? `<tr><td style="padding: 6px 0; color: #666;">Horario:</td><td style="padding: 6px 0; font-weight: bold;">${scheduledTime}</td></tr>` : ''}
                        ${amount ? `<tr><td style="padding: 6px 0; color: #666;">Monto pagado:</td><td style="padding: 6px 0; font-weight: bold; color: #166534;">${amount}</td></tr>` : ''}
                        <tr><td style="padding: 6px 0; color: #666;">N° Orden:</td><td style="padding: 6px 0; font-family: monospace; font-weight: bold;">#${bookingId}</td></tr>
                    </table>
                </div>

                <!-- Provider Contact Card -->
                <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px;">👤 Datos de tu Profesional</h3>
                    <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">Contacta al proveedor para coordinar los detalles del servicio:</p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 6px 0; color: #666; width: 120px;">Nombre:</td><td style="padding: 6px 0; font-weight: bold;">${provider.name}</td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Teléfono:</td><td style="padding: 6px 0;"><a href="tel:${provider.phone}" style="color: #2563eb; font-weight: bold; text-decoration: none;">${provider.phone}</a></td></tr>
                        <tr><td style="padding: 6px 0; color: #666;">Email:</td><td style="padding: 6px 0;"><a href="mailto:${provider.email}" style="color: #2563eb; font-weight: bold; text-decoration: none;">${provider.email}</a></td></tr>
                    </table>
                </div>

                <!-- Escrow Guarantee -->
                <div style="background-color: #fefce8; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #fde68a;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                        🛡️ <strong>Pago Protegido:</strong> Tu dinero está en custodia segura de Serviciosatuhogar. El proveedor no recibe el pago hasta que el servicio se haya completado a tu satisfacción.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                <!-- CTA: Register -->
                <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fff7ed, #ffedd5); border-radius: 8px; border: 1px solid #fed7aa;">
                    <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 18px;">¿Sabías que puedes tener tu propia cuenta?</h3>
                    <p style="color: #78350f; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
                        Crea tu cuenta gratis y accede a beneficios exclusivos:
                    </p>
                    <ul style="text-align: left; color: #78350f; font-size: 13px; margin: 0 0 20px 0; padding-left: 20px; line-height: 1.8;">
                        <li>📊 Historial completo de tus servicios contratados</li>
                        <li>⭐ Deja reseñas y ayuda a otros clientes</li>
                        <li>🔔 Recibe notificaciones en tiempo real</li>
                        <li>💳 Guarda tus datos para futuras contrataciones</li>
                        <li>🛡️ Gestiona disputas y reclamos desde tu panel</li>
                    </ul>
                    <a href="${appUrl}/client/register" 
                       style="display: inline-block; background: linear-gradient(135deg, #ea580c, #f97316); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                        Crear Mi Cuenta Gratis →
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="padding: 16px; text-align: center; background: #f3f4f6; border-radius: 0 0 8px 8px; border: 1px solid #eee; border-top: none;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Guarda este correo como comprobante de tu reserva.<br>
                    Este es un mensaje automático de Serviciosatuhogar.
                </p>
            </div>
        </div>
    `;

    await sendEmail({ to: guest.email, subject, html });
    logger.info('[Guest Email] Booking confirmation sent.', { bookingId });
};

export default { sendEmail, notifyAdmin, sendInvoiceEmail, sendCrossContactEmails, sendGuestBookingConfirmation };

