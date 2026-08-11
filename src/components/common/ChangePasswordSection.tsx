import React, { useState } from 'react';
import { api } from '../../api/client';
import { Shield, Eye, EyeOff, CheckCircle2, Loader2, Lock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * ChangePasswordSection — Reusable component for both Provider and Client dashboards.
 * Allows authenticated users to change their password with real-time validation.
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

const ChangePasswordSection: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const passwordStrength = getPasswordStrength(newPassword);
    const passwordRequirements = [
        { met: newPassword.length >= 8, text: 'Al menos 8 caracteres' },
        { met: /[A-Z]/.test(newPassword), text: 'Una letra mayúscula' },
        { met: /[a-z]/.test(newPassword), text: 'Una letra minúscula' },
        { met: /[0-9]/.test(newPassword), text: 'Un número' },
    ];

    const isFormValid = currentPassword &&
        passwordRequirements.every(r => r.met) &&
        newPassword === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isFormValid) return;

        setLoading(true);
        setSuccess(false);

        try {
            const response = await api.post('/auth/change-password', {
                currentPassword,
                newPassword
            });

            if (response.data.status === 'success') {
                setSuccess(true);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                toast.success('Contraseña actualizada exitosamente.');

                // Auto-dismiss success after 5 seconds
                setTimeout(() => setSuccess(false), 5000);
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al cambiar la contraseña.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Seguridad de la Cuenta</h2>
                        <p className="text-sm text-gray-500">Cambia tu contraseña para mantener tu cuenta protegida</p>
                    </div>
                </div>
            </div>

            {/* Success banner */}
            {success && (
                <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-pulse">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">
                        ¡Tu contraseña ha sido actualizada exitosamente!
                    </p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Current Password */}
                <div>
                    <label htmlFor="change-current-pw" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Contraseña Actual
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            id="change-current-pw"
                            type={showCurrent ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Ingresa tu contraseña actual"
                            className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <hr className="border-gray-100" />

                {/* New Password */}
                <div>
                    <label htmlFor="change-new-pw" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nueva Contraseña
                    </label>
                    <div className="relative">
                        <input
                            id="change-new-pw"
                            type={showNew ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    {newPassword && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {passwordRequirements.map((req, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                                        req.met ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                        <span className="text-[8px]">{req.met ? '✓' : '○'}</span>
                                    </div>
                                    <span className={req.met ? 'text-green-700' : 'text-gray-500'}>{req.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div>
                    <label htmlFor="change-confirm-pw" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Confirmar Nueva Contraseña
                    </label>
                    <div className="relative">
                        <input
                            id="change-confirm-pw"
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repite tu nueva contraseña"
                            className={`w-full px-4 py-2.5 pr-12 border rounded-lg focus:ring-2 focus:ring-brand-primary text-sm ${
                                confirmPassword && confirmPassword !== newPassword
                                    ? 'border-red-300'
                                    : confirmPassword && confirmPassword === newPassword
                                    ? 'border-green-300'
                                    : 'border-gray-300'
                            }`}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Las contraseñas no coinciden
                        </p>
                    )}
                    {confirmPassword && confirmPassword === newPassword && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                        </p>
                    )}
                </div>

                {/* Submit */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading || !isFormValid}
                        className="w-full sm:w-auto px-6 py-2.5 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChangePasswordSection;
