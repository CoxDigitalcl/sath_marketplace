/**
 * Enforces function-level authorization after authenticateToken has populated req.user.
 * Keeping this separate from authentication makes the policy reusable and unit-testable.
 */
export const requireRole = (...allowedRoles) => {
    const roles = new Set(allowedRoles.flat().filter(Boolean));

    if (roles.size === 0) {
        throw new Error('requireRole needs at least one allowed role');
    }

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Autenticacion requerida.',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!roles.has(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para realizar esta accion.',
                code: 'ROLE_REQUIRED'
            });
        }

        return next();
    };
};
