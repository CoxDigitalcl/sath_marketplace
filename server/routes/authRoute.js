import express from 'express';
import { register, login } from '../controllers/identityController.js';
import { requestPasswordReset, verifyResetCode, resetPassword, changePassword, logout, createAdminStepUp } from '../controllers/passwordSecurityController.js';
import { validate, registerSchema, loginSchema, forgotPasswordSchema, verifyResetCodeSchema, resetPasswordSchema, changePasswordSchema, adminStepUpSchema } from '../utils/validation.js';
import { authenticateToken } from '../middleware/sessionAuth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for registration (MED-03)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per IP per hour
    message: { status: 'error', message: 'Demasiados intentos de registro. Intenta nuevamente en 1 hora.' }
});

// Register Route: POST /api/auth/register
router.post('/register', registerLimiter, validate(registerSchema), register);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // 15 login attempts per IP per window
    message: { status: 'error', message: 'Demasiados intentos de inicio de sesión, por favor intente nuevamente en 15 minutos.' }
});

// Login Route: POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), login);

// =====================================================
// PASSWORD RECOVERY ROUTES
// =====================================================

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Only 3 requests per window (more restrictive)
    message: { status: 'error', message: 'Demasiados intentos. Por favor, espera 15 minutos antes de solicitar otro código.' }
});

const verifyCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Allow some retries for mistyped codes
    message: { status: 'error', message: 'Demasiados intentos de verificación. Por favor, solicita un nuevo código.' }
});

const adminStepUpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { status: 'error', message: 'Demasiados intentos de confirmación. Intenta nuevamente en 15 minutos.' }
});

// POST /api/auth/forgot-password — Request a reset code
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), requestPasswordReset);

// POST /api/auth/verify-reset-code — Verify the 6-digit code
router.post('/verify-reset-code', verifyCodeLimiter, validate(verifyResetCodeSchema), verifyResetCode);

// POST /api/auth/reset-password — Set new password (with reset session token)
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// POST /api/auth/change-password — Change password (authenticated user)
router.post('/change-password', authenticateToken, validate(changePasswordSchema), changePassword);

// Revokes every active access token for the authenticated account.
router.post('/logout', authenticateToken, logout);

// Returns a five-minute credential for critical admin actions.
router.post('/step-up', authenticateToken, adminStepUpLimiter, validate(adminStepUpSchema), createAdminStepUp);

export default router;
