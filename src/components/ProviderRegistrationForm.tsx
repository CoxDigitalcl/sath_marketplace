import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Page } from '../types';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff, Loader2, ArrowRight, Briefcase, TrendingUp, CheckCircle, DollarSign, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProviderRegistrationFormProps {
  navigateTo: (page: Page) => void;
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

const ProviderRegistrationForm: React.FC<ProviderRegistrationFormProps> = ({ navigateTo }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const registerRes = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone,
        role: 'provider'
      });

      if (registerRes.data.status !== 'success') {
        throw new Error(registerRes.data.message || 'Falló el registro de cuenta.');
      }

      const { token, user } = registerRes.data;
      login(token, user);

      toast.success("¡Cuenta creada exitosamente! Completa tu perfil para activar tu cuenta.");
      navigateTo('provider-dashboard');

    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorData.errors.forEach((err: { field: string; message: string }) => {
          toast.error(`${err.message}`);
        });
      } else {
        const msg = errorData?.message || 'Error durante el registro. Intenta nuevamente.';
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordHints = [
    { met: formData.password.length >= 8, text: 'Al menos 8 caracteres' },
    { met: /[A-Z]/.test(formData.password), text: 'Una letra mayúscula' },
    { met: /[a-z]/.test(formData.password), text: 'Una letra minúscula' },
    { met: /[0-9]/.test(formData.password), text: 'Un número' },
  ];
  const passwordMet = passwordHints.filter(h => h.met).length;
  const allPasswordMet = passwordMet === passwordHints.length;
  const passwordStrength = formData.password.length > 0 ? (passwordMet / passwordHints.length) * 100 : 0;
  const strengthColor = passwordStrength <= 25 ? 'bg-red-500' : passwordStrength <= 50 ? 'bg-orange-500' : passwordStrength <= 75 ? 'bg-amber-500' : 'bg-green-500';
  const strengthLabel = passwordStrength <= 25 ? 'Débil' : passwordStrength <= 50 ? 'Regular' : passwordStrength <= 75 ? 'Buena' : 'Segura';

  return (
    <div className="min-h-screen flex bg-white">
      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 bg-orange-50 text-brand-primary rounded-full px-3 py-1.5 text-xs font-semibold mb-4">
              <Briefcase className="w-3.5 h-3.5" />
              Registro de Proveedor
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Únete como Proveedor</h1>
            <p className="mt-2 text-gray-500 text-[15px]">
              Crea tu cuenta en segundos y comienza a hacer crecer tu negocio.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              id="provider-fullName"
              label="Nombre Completo"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              autoComplete="name"
              required
            />

            <FloatingInput
              id="provider-phone"
              label="Teléfono"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              autoComplete="tel"
              required
            />

            <FloatingInput
              id="provider-email"
              label="Correo Electrónico"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              autoComplete="email"
              required
            />

            <div>
              <FloatingInput
                id="provider-password"
                label="Contraseña"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
                required
                showToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />
              {formData.password && (
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
              className="w-full py-3.5 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-200/40 hover:shadow-orange-300/60 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Creando Cuenta...' : 'Crear Cuenta de Proveedor'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Siguiente paso:</strong> Después de crear tu cuenta, completarás tu perfil profesional 
              y subirás los documentos de verificación (KYC) para activar tu cuenta.
            </p>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes una cuenta?{' '}
            <button onClick={() => navigateTo('login')} className="font-semibold text-brand-primary hover:text-orange-600 transition-colors">
              Inicia Sesión
            </button>
          </p>
        </div>
      </div>

      {/* ═══ RIGHT: Visual Panel ═══ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />

        {/* Decorative */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-full h-full opacity-5">
            <div className="absolute top-20 left-20 w-64 h-64 border border-orange-400/30 rounded-full" />
            <div className="absolute bottom-40 right-10 w-80 h-80 border border-orange-400/20 rounded-full" />
            <div className="absolute top-1/3 right-1/4 w-40 h-40 border border-orange-400/25 rounded-full" />
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-primary/20 backdrop-blur-sm rounded-full px-4 py-2 text-brand-primary text-sm font-medium border border-brand-primary/30">
              <TrendingUp className="w-4 h-4" />
              Haz crecer tu negocio
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Lleva tu<br />negocio al<br />siguiente nivel.
            </h2>
            <p className="text-gray-400 text-lg max-w-sm leading-relaxed">
              Publica tus servicios y gestiona solicitudes, agenda y pagos desde un solo lugar.
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-5">
            {[
              { icon: DollarSign, title: 'Pagos Registrados', desc: 'Consulta y concilia el estado de tus cobros en la plataforma' },
              { icon: BarChart3, title: 'Dashboard Profesional', desc: 'Analíticas y gestión de órdenes en tiempo real' },
              { icon: Briefcase, title: 'Identidad Verificada', desc: 'La plataforma confirma la identidad asociada a tu cuenta' },
            ].map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/15 flex items-center justify-center flex-shrink-0 border border-brand-primary/20">
                  <benefit.icon className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{benefit.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderRegistrationForm;
