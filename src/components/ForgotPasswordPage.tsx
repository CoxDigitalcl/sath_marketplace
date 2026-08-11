import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Mail, ArrowLeft, KeyRound, ShieldCheck, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'email' | 'check-email' | 'enter-code' | 'new-password' | 'success';

// Password strength checker
const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score: 1, label: 'Débil', color: 'bg-red-500' };
    if (score <= 4) return { score: 2, label: 'Media', color: 'bg-yellow-500' };
    return { score: 3, label: 'Fuerte', color: 'bg-green-500' };
};

const ForgotPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Auto-focus first code input when entering code step
    useEffect(() => {
        if (step === 'enter-code') {
            setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
        }
    }, [step]);

    // --- Step 1: Submit email ---
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setStep('check-email');
            setResendCooldown(60);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al enviar el código. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    // --- Step 2 → 3: Enter code manually ---
    const handleCodeChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Only digits

        const newCode = [...code];
        newCode[index] = value.slice(-1); // Only last char
        setCode(newCode);

        // Auto-focus next input
        if (value && index < 5) {
            codeInputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 filled
        if (newCode.every(d => d !== '') && value) {
            handleVerifyCode(newCode.join(''));
        }
    };

    const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            codeInputRefs.current[index - 1]?.focus();
        }
    };

    const handleCodePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData.length === 6) {
            const newCode = pastedData.split('');
            setCode(newCode);
            codeInputRefs.current[5]?.focus();
            handleVerifyCode(pastedData);
        }
    };

    // --- Step 3: Verify Code ---
    const handleVerifyCode = async (codeStr: string) => {
        setLoading(true);
        try {
            const response = await api.post('/auth/verify-reset-code', { email, code: codeStr });
            if (response.data.status === 'success') {
                setResetToken(response.data.resetToken);
                setStep('new-password');
                toast.success('¡Código verificado correctamente!');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Código incorrecto o expirado.');
            setCode(['', '', '', '', '', '']);
            codeInputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    // --- Step 4: Reset Password ---
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { resetToken, newPassword });
            setStep('success');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    // --- Resend code ---
    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setResendCooldown(60);
            toast.success('Se ha enviado un nuevo código a tu correo.');
        } catch {
            toast.error('Error al reenviar el código.');
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = getPasswordStrength(newPassword);
    const passwordRequirements = [
        { met: newPassword.length >= 8, text: 'Al menos 8 caracteres' },
        { met: /[A-Z]/.test(newPassword), text: 'Una letra mayúscula' },
        { met: /[a-z]/.test(newPassword), text: 'Una letra minúscula' },
        { met: /[0-9]/.test(newPassword), text: 'Un número' },
    ];

    // --- Progress Stepper ---
    const steps = [
        { key: 'email', label: 'Email' },
        { key: 'code', label: 'Verificar' },
        { key: 'password', label: 'Nueva Contraseña' },
        { key: 'done', label: 'Listo' },
    ];

    const getStepIndex = () => {
        switch (step) {
            case 'email': return 0;
            case 'check-email': return 1;
            case 'enter-code': return 1;
            case 'new-password': return 2;
            case 'success': return 3;
            default: return 0;
        }
    };

    return (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 py-12 px-4">
            <div className="w-full max-w-md">

                {/* Progress Stepper */}
                <div className="mb-8">
                    <div className="flex items-center justify-between relative">
                        {steps.map((s, i) => (
                            <div key={s.key} className="flex flex-col items-center z-10 relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                                    i <= getStepIndex()
                                        ? 'bg-brand-primary text-white shadow-md shadow-orange-200'
                                        : 'bg-gray-200 text-gray-400'
                                }`}>
                                    {i < getStepIndex() ? '✓' : i + 1}
                                </div>
                                <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
                                    i <= getStepIndex() ? 'text-brand-primary' : 'text-gray-400'
                                }`}>{s.label}</span>
                            </div>
                        ))}
                        {/* Progress line */}
                        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-0" style={{ margin: '0 16px' }}>
                            <div 
                                className="h-full bg-brand-primary transition-all duration-700 ease-out rounded-full"
                                style={{ width: `${(getStepIndex() / (steps.length - 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    
                    {/* ===== STEP 1: Email ===== */}
                    {step === 'email' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-orange-50 border-2 border-orange-100 rounded-2xl flex items-center justify-center">
                                    <KeyRound className="w-8 h-8 text-brand-primary" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">¿Olvidaste tu contraseña?</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                No te preocupes. Ingresa tu correo electrónico y te enviaremos un código de verificación para restablecer tu contraseña.
                            </p>

                            <form onSubmit={handleEmailSubmit} className="mt-8 space-y-5">
                                <div>
                                    <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo Electrónico</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            id="forgot-email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="tu@correo.com"
                                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm transition-shadow"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full py-3 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-orange-200/50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                    {loading ? 'Enviando...' : 'Enviar Código de Verificación'}
                                </button>
                            </form>

                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver al inicio de sesión
                            </button>
                        </div>
                    )}

                    {/* ===== STEP 2: Check Email ===== */}
                    {step === 'check-email' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-center justify-center">
                                    <Mail className="w-8 h-8 text-blue-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">Revisa tu correo</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                Hemos enviado un código de verificación de 6 dígitos a{' '}
                                <strong className="text-gray-700">{email}</strong>
                            </p>
                            <p className="text-gray-400 text-center mt-1 text-xs">
                                Revisa también tu carpeta de spam o correo no deseado.
                            </p>

                            <div className="mt-8 space-y-3">
                                <button
                                    onClick={() => setStep('enter-code')}
                                    className="w-full py-3 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-orange-200/50"
                                >
                                    Ingresar código manualmente
                                </button>

                                <button
                                    onClick={handleResend}
                                    disabled={resendCooldown > 0 || loading}
                                    className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    {resendCooldown > 0
                                        ? `Reenviar código en ${resendCooldown}s`
                                        : '¿No recibiste el código? Reenviar'}
                                </button>
                            </div>

                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver al inicio de sesión
                            </button>
                        </div>
                    )}

                    {/* ===== STEP 3: Enter Code ===== */}
                    {step === 'enter-code' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-purple-50 border-2 border-purple-100 rounded-2xl flex items-center justify-center">
                                    <ShieldCheck className="w-8 h-8 text-purple-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">Ingresa el código</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                Escribe el código de 6 dígitos que enviamos a <strong className="text-gray-700">{email}</strong>
                            </p>

                            <div className="mt-8 flex justify-center gap-2" onPaste={handleCodePaste}>
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={el => { codeInputRefs.current[index] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                                        className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary ${
                                            digit ? 'border-brand-primary bg-orange-50' : 'border-gray-300'
                                        }`}
                                        disabled={loading}
                                    />
                                ))}
                            </div>

                            {loading && (
                                <div className="flex items-center justify-center gap-2 mt-4 text-brand-primary text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Verificando código...
                                </div>
                            )}

                            <div className="mt-6 text-center">
                                <button
                                    onClick={handleResend}
                                    disabled={resendCooldown > 0 || loading}
                                    className="text-sm text-gray-600 hover:text-brand-primary transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    {resendCooldown > 0
                                        ? `Reenviar en ${resendCooldown}s`
                                        : '¿No recibiste el código? Reenviar'}
                                </button>
                            </div>

                            <button
                                onClick={() => setStep('check-email')}
                                className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver
                            </button>
                        </div>
                    )}

                    {/* ===== STEP 4: New Password ===== */}
                    {step === 'new-password' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center justify-center">
                                    <KeyRound className="w-8 h-8 text-green-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">Crea tu nueva contraseña</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                Elige una contraseña segura que no hayas usado anteriormente.
                            </p>

                            <form onSubmit={handleResetPassword} className="mt-8 space-y-5">
                                {/* New Password */}
                                <div>
                                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">Nueva Contraseña</label>
                                    <div className="relative">
                                        <input
                                            id="new-password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Mínimo 8 caracteres"
                                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm transition-shadow"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Strength Meter */}
                                    {newPassword && (
                                        <div className="mt-2">
                                            <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                                                {[1, 2, 3].map(level => (
                                                    <div
                                                        key={level}
                                                        className={`flex-1 rounded-full transition-all duration-300 ${
                                                            level <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <p className={`text-xs mt-1 font-medium ${
                                                passwordStrength.score === 1 ? 'text-red-500' :
                                                passwordStrength.score === 2 ? 'text-yellow-600' : 'text-green-600'
                                            }`}>
                                                Fortaleza: {passwordStrength.label}
                                            </p>
                                        </div>
                                    )}

                                    {/* Requirements */}
                                    <div className="mt-3 space-y-1">
                                        {passwordRequirements.map((req, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                                                    req.met ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {req.met ? '✓' : '○'}
                                                </div>
                                                <span className={req.met ? 'text-green-700' : 'text-gray-500'}>{req.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Contraseña</label>
                                    <div className="relative">
                                        <input
                                            id="confirm-password"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repite tu nueva contraseña"
                                            className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-brand-primary text-sm transition-shadow ${
                                                confirmPassword && confirmPassword !== newPassword
                                                    ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                                                    : confirmPassword && confirmPassword === newPassword
                                                    ? 'border-green-300 focus:border-green-400 focus:ring-green-200'
                                                    : 'border-gray-300 focus:border-brand-primary'
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {confirmPassword && confirmPassword !== newPassword && (
                                        <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                                    )}
                                    {confirmPassword && confirmPassword === newPassword && (
                                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !passwordRequirements.every(r => r.met) || newPassword !== confirmPassword}
                                    className="w-full py-3 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-orange-200/50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                    {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ===== STEP 5: Success ===== */}
                    {step === 'success' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-20 h-20 bg-green-50 border-2 border-green-100 rounded-full flex items-center justify-center animate-bounce">
                                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">¡Contraseña actualizada!</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
                            </p>

                            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-green-800">Tu cuenta está segura</p>
                                        <p className="text-xs text-green-600 mt-1">
                                            Si no fuiste tú quien realizó este cambio, contacta a soporte inmediatamente.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/login')}
                                className="w-full mt-6 py-3 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-orange-200/50"
                            >
                                Ir a Iniciar Sesión
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer help text */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    ¿Necesitas ayuda? Contáctanos en{' '}
                    <a href="mailto:soporte@serviciosatuhogar.cl" className="text-brand-primary hover:underline">
                        soporte@serviciosatuhogar.cl
                    </a>
                </p>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
