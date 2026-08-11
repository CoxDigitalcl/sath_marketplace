import express from 'express';
import { register, login, requestPasswordReset, verifyResetCode, resetPassword, changePassword } from '../controllers/authController.js';
import { validate, registerSchema, loginSchema, forgotPasswordSchema, verifyResetCodeSchema, resetPasswordSchema, changePasswordSchema } from '../utils/validation.js';
import { authenticateToken } from '../middleware/auth.js';
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

// POST /api/auth/forgot-password — Request a reset code
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), requestPasswordReset);

// POST /api/auth/verify-reset-code — Verify the 6-digit code
router.post('/verify-reset-code', verifyCodeLimiter, validate(verifyResetCodeSchema), verifyResetCode);

// POST /api/auth/reset-password — Set new password (with reset session token)
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// POST /api/auth/change-password — Change password (authenticated user)
router.post('/change-password', authenticateToken, validate(changePasswordSchema), changePassword);

export default router;
