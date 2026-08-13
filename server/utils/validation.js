import { z } from 'zod';

// Register Schema
// Validates email, password strength, and role
export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
        .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
        .regex(/[0-9]/, 'Debe incluir al menos un número'),
    role: z.enum(['client', 'provider'], {
        errorMap: () => ({ message: 'Role must be either client or provider' }),
    }),
    fullName: z.string().optional(), // Optional for client, required logic for provider handled in controller or frontend
    phone: z.string().optional(),
});

// Login Schema
// Checks for email and password presence
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
    email: z.string().email('Por favor, ingresa un correo electrónico válido'),
});

// Verify Reset Code Schema
export const verifyResetCodeSchema = z.object({
    email: z.string().email('Email inválido'),
    code: z.string().length(6, 'El código debe ser de 6 dígitos'),
});

// Reset Password Schema (after code verification)
export const resetPasswordSchema = z.object({
    resetToken: z.string().min(1, 'Token de reset requerido'),
    newPassword: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
        .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
        .regex(/[0-9]/, 'Debe incluir al menos un número'),
});

// Change Password Schema (authenticated user)
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
        .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
        .regex(/[0-9]/, 'Debe incluir al menos un número'),
});

export const adminStepUpSchema = z.object({
    password: z.string().min(1, 'La contraseña es requerida').max(256, 'La contraseña es demasiado larga'),
});

// Helper validation function
export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: error.errors.map((e) => ({
                    field: e.path[0],
                    message: e.message
                })),
            });
        }
        next(error);
    }
};
