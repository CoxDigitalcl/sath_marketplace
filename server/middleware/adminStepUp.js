import { hasCurrentTokenVersion, verifyAdminStepUpToken } from '../services/sessionSecurity.js';

export const requireAdminStepUp = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            status: 'error',
            code: 'ADMIN_REQUIRED',
            message: 'Acceso de administrador requerido.'
        });
    }

    const token = req.get('x-admin-step-up');
    if (!token) {
        return res.status(403).json({
            status: 'error',
            code: 'STEP_UP_REQUIRED',
            message: 'Confirma nuevamente tu contraseña para realizar esta acción.'
        });
    }

    try {
        const claims = verifyAdminStepUpToken(token);
        if (claims.id !== req.user.id || !hasCurrentTokenVersion(claims, req.user)) {
            throw new Error('Step-up token does not match the active session.');
        }
        req.adminStepUp = claims;
        return next();
    } catch {
        return res.status(403).json({
            status: 'error',
            code: 'STEP_UP_INVALID',
            message: 'La confirmación de seguridad expiró. Intenta nuevamente.'
        });
    }
};
