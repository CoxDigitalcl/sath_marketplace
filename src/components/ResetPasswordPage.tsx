import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { KeyRound, CheckCircle2, ShieldCheck, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * ResetPasswordPage — Handles link-based password reset.
 * Reached via /reset-password?token=<jwt_reset_session_token>
 * This page is used when the admin forces a password reset and the user clicks the emailed link.
 */

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

const ResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('Enlace de recuperación inválido. No se encontró un token válido en la URL.');
        }
    }, [token]);

    const passwordStrength = getPasswordStrength(newPassword);
    const passwordRequirements = [
        { met: newPassword.length >= 8, text: 'Al menos 8 caracteres' },
        { met: /[A-Z]/.test(newPassword), text: 'Una letra mayúscula' },
        { met: /[a-z]/.test(newPassword), text: 'Una letra minúscula' },
        { met: /[0-9]/.test(newPassword), text: 'Un número' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { resetToken: token, newPassword });
            setStatus('success');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al actualizar la contraseña.';
            if (msg.includes('expirado') || msg.includes('inválido')) {
                setStatus('error');
                setErrorMessage(msg);
            } else {
                toast.error(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 py-12 px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">

                    {/* ===== FORM ===== */}
                    {status === 'form' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center justify-center">
                                    <KeyRound className="w-8 h-8 text-green-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">Crea tu nueva contraseña</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                Elige una contraseña segura que no hayas usado anteriormente. Asegúrate de que cumpla todos los requisitos de seguridad.
                            </p>

                            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                                <div>
                                    <label htmlFor="reset-new-password" className="block text-sm font-medium text-gray-700 mb-1.5">Nueva Contraseña</label>
                                    <div className="relative">
                                        <input
                                            id="reset-new-password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Mínimo 8 caracteres"
                                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {newPassword && (
                                        <div className="mt-2">
                                            <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                                                {[1, 2, 3].map(level => (
                                                    <div key={level} className={`flex-1 rounded-full transition-all duration-300 ${level <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200'}`} />
                                                ))}
                                            </div>
                                            <p className={`text-xs mt-1 font-medium ${passwordStrength.score === 1 ? 'text-red-500' : passwordStrength.score === 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                Fortaleza: {passwordStrength.label}
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-3 space-y-1">
                                        {passwordRequirements.map((req, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${req.met ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    {req.met ? '✓' : '○'}
                                                </div>
                                                <span className={req.met ? 'text-green-700' : 'text-gray-500'}>{req.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Contraseña</label>
                                    <div className="relative">
                                        <input
                                            id="reset-confirm-password"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repite tu nueva contraseña"
                                            className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-brand-primary text-sm ${
                                                confirmPassword && confirmPassword !== newPassword ? 'border-red-300' :
                                                confirmPassword && confirmPassword === newPassword ? 'border-green-300' : 'border-gray-300'
                                            }`}
                                        />
                                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {confirmPassword && confirmPassword !== newPassword && <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>}
                                    {confirmPassword && confirmPassword === newPassword && (
                                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden</p>
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

                    {/* ===== SUCCESS ===== */}
                    {status === 'success' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-20 h-20 bg-green-50 border-2 border-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">¡Contraseña actualizada!</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">
                                Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
                            </p>
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-green-800">Tu cuenta está segura. Si no fuiste tú, contacta a soporte.</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/login')} className="w-full mt-6 py-3 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-orange-200/50">
                                Ir a Iniciar Sesión
                            </button>
                        </div>
                    )}

                    {/* ===== ERROR ===== */}
                    {status === 'error' && (
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <div className="w-20 h-20 bg-red-50 border-2 border-red-100 rounded-full flex items-center justify-center">
                                    <XCircle className="w-10 h-10 text-red-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 text-center">Enlace Expirado</h2>
                            <p className="text-gray-500 text-center mt-2 text-sm leading-relaxed">{errorMessage}</p>
                            <div className="mt-8 space-y-3">
                                <button onClick={() => navigate('/forgot-password')} className="w-full py-3 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-orange-200/50">
                                    Solicitar Nuevo Código
                                </button>
                                <button onClick={() => navigate('/login')} className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                                    Volver al inicio de sesión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
