import React, { useState, FormEvent } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Sparkles, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

/* ── Floating Label Input ── */
const FloatingInput: React.FC<{
    id: string;
    label: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    autoComplete?: string;
    required?: boolean;
    showToggle?: boolean;
    showPassword?: boolean;
    onTogglePassword?: () => void;
}> = ({ id, label, type = 'text', value, onChange, autoComplete, required, showToggle, showPassword, onTogglePassword }) => {
    const [focused, setFocused] = useState(false);
    const isActive = focused || value.length > 0;
    const inputType = showToggle ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="relative">
            <input
                id={id}
                name={id}
                type={inputType}
                value={value}
                onChange={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoComplete={autoComplete}
                required={required}
                className={`peer w-full px-4 pt-6 pb-2 text-sm text-gray-900 bg-transparent border-2 rounded-xl outline-none transition-all duration-200 ${
                    focused
                        ? 'border-brand-primary ring-2 ring-brand-primary/20'
                        : 'border-gray-200 hover:border-gray-300'
                } ${showToggle ? 'pr-12' : ''}`}
            />
            <label
                htmlFor={id}
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    isActive
                        ? 'top-1.5 text-[11px] font-semibold tracking-wide text-brand-primary'
                        : 'top-1/2 -translate-y-1/2 text-sm text-gray-400'
                }`}
            >
                {label}
            </label>
            {showToggle && (
                <button
                    type="button"
                    onClick={onTogglePassword}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
            )}
        </div>
    );
};

const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const login = useAuthStore((state) => state.login);

    if (!isOpen) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/auth/register', {
                email,
                password,
                phone,
                role: 'client',
                fullName,
            });

            if (response.data.status === 'success') {
                const { token, user } = response.data;
                login(token, user);
                toast.success(`¡Bienvenido, ${fullName}! Cuenta creada exitosamente.`);
                onSuccess();
            }
        } catch (error: any) {
            const errorData = error.response?.data;
            if (errorData?.errors && Array.isArray(errorData.errors)) {
                // Show each field-specific validation error
                errorData.errors.forEach((err: { field: string; message: string }) => {
                    toast.error(`${err.message}`);
                });
            } else {
                const msg = errorData?.message || 'Error al crear la cuenta. Intenta nuevamente.';
                toast.error(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const passwordHints = [
        { met: password.length >= 8, text: 'Al menos 8 caracteres' },
        { met: /[A-Z]/.test(password), text: 'Una letra mayúscula' },
        { met: /[a-z]/.test(password), text: 'Una letra minúscula' },
        { met: /[0-9]/.test(password), text: 'Un número' },
    ];
    const passwordMet = passwordHints.filter(h => h.met).length;
    const allPasswordMet = passwordMet === passwordHints.length;
    const passwordStrength = password.length > 0 ? (passwordMet / passwordHints.length) * 100 : 0;
    const strengthColor = passwordStrength <= 25 ? 'bg-red-500' : passwordStrength <= 50 ? 'bg-orange-500' : passwordStrength <= 75 ? 'bg-amber-500' : 'bg-green-500';
    const strengthLabel = passwordStrength <= 25 ? 'Débil' : passwordStrength <= 50 ? 'Regular' : passwordStrength <= 75 ? 'Buena' : 'Segura';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                {/* Close button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left Panel (Visual Branding) */}
                <div className="hidden md:flex relative w-1/2 overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute -top-10 -right-10 w-80 h-80 border-2 border-white/30 rounded-full" />
                        <div className="absolute top-1/2 -left-20 w-96 h-96 border border-white/20 rounded-full" />
                        <div className="absolute bottom-20 right-10 w-40 h-40 border border-white/25 rounded-full" />
                    </div>

                    <div className="relative z-10 flex flex-col justify-between p-10 w-full">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-4 py-2 text-white/90 text-xs font-semibold uppercase tracking-wider">
                                <Sparkles className="w-4 h-4 text-amber-200" />
                                Rápido y Seguro
                            </div>
                        </div>

                        <div className="space-y-6 mt-8">
                            <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                                Contrata con<br />confianza.
                            </h2>
                            <p className="text-white/80 text-sm leading-relaxed max-w-[280px]">
                                Crea una cuenta en un solo paso para acceder a tus reservas, revisar a los profesionales y acumular puntos en tus compras garantizadas.
                            </p>
                        </div>

                        <div className="space-y-3 mt-8">
                            {[
                                'Notificaciones de tus servicios',
                                'Pagos guardados',
                                'Soporte prioritario',
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-sm">
                                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <span className="text-white/90 text-sm font-medium">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel (Form) */}
                <div className="w-full md:w-1/2 flex flex-col p-8 sm:p-10 overflow-y-auto">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Crea tu cuenta</h2>
                        <p className="mt-1 text-gray-500 text-sm">
                            Tu información estará guardada y segura para agilizar tus compras.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 flex-grow">
                        <FloatingInput
                            id="modal-fullname"
                            label="Nombre Completo"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                            required
                        />

                        <FloatingInput
                            id="modal-email"
                            label="Correo Electrónico"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                        
                        <FloatingInput
                            id="modal-phone"
                            label="Teléfono Móvil (Ej: +56 9 1234 5678)"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            autoComplete="tel"
                            required
                        />

                        <div>
                            <FloatingInput
                                id="modal-password"
                                label="Crea tu Contraseña"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                                showToggle
                                showPassword={showPassword}
                                onTogglePassword={() => setShowPassword(!showPassword)}
                            />
                            {password && (
                                <div className="mt-2.5 px-1 space-y-2">
                                    {/* Strength Bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ease-out ${strengthColor}`}
                                                style={{ width: `${passwordStrength}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-semibold tracking-wide uppercase ${passwordStrength <= 50 ? 'text-gray-400' : passwordStrength <= 75 ? 'text-amber-600' : 'text-green-600'}`}>
                                            {strengthLabel}
                                        </span>
                                    </div>
                                    {/* Individual checks */}
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                        {passwordHints.map((h, i) => (
                                            <span key={i} className={`text-[11px] flex items-center gap-1.5 font-medium transition-colors duration-300 ${h.met ? 'text-green-600' : 'text-gray-400'}`}>
                                                <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-300 ${h.met ? 'text-green-500 scale-110' : 'text-gray-300'}`} />
                                                <span className={h.met ? 'line-through decoration-green-400/50' : ''}>{h.text}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !allPasswordMet}
                            className="w-full mt-4 py-3.5 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-200/40 hover:shadow-orange-300/60"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            {loading ? 'Validando...' : 'Crear Cuenta y Continuar'}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>
                    
                    <p className="mt-6 text-center text-xs text-gray-400 font-medium">
                        Al registrarte, aceptas los Términos y Condiciones y la Política de Privacidad de Serviciosatuhogar.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterModal;
