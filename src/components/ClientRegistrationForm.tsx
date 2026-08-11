import React, { useState, FormEvent } from 'react';
import { Page } from '../types';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Users, Sparkles, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientRegistrationFormProps {
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

const ClientRegistrationForm: React.FC<ClientRegistrationFormProps> = ({ navigateTo }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error('Debes aceptar los términos y la política de privacidad para continuar.');
      return;
    }
    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        role: 'client',
        fullName,
      });

      if (response.data.status === 'success') {
        const { token, user } = response.data;
        login(token, user);
        toast.success(`¡Bienvenido, ${fullName}! Tu cuenta ha sido creada exitosamente.`);
        navigateTo('home');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Error al crear la cuenta. Intenta nuevamente.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Password strength hints
  const passwordHints = [
    { met: password.length >= 8, text: 'Al menos 8 caracteres' },
    { met: /[A-Z]/.test(password), text: 'Una mayúscula' },
    { met: /[0-9]/.test(password), text: 'Un número' },
  ];

  return (
    <div className="min-h-screen flex bg-white">
      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 bg-orange-50 text-brand-primary rounded-full px-3 py-1.5 text-xs font-semibold mb-4">
              <Users className="w-3.5 h-3.5" />
              Registro de Cliente
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Crea tu cuenta</h1>
            <p className="mt-2 text-gray-500 text-[15px]">
              Encuentra los mejores profesionales para las necesidades de tu hogar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              id="client-fullname"
              label="Nombre Completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />

            <FloatingInput
              id="client-email"
              label="Correo Electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <div>
              <FloatingInput
                id="client-password"
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                showToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />
              {/* Inline requirements */}
              {password && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
                  {passwordHints.map((h, i) => (
                    <span key={i} className={`text-[11px] flex items-center gap-1 ${h.met ? 'text-green-600' : 'text-gray-400'}`}>
                      <CheckCircle className={`w-3 h-3 ${h.met ? 'text-green-500' : 'text-gray-300'}`} />
                      {h.text}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-brand-primary border-gray-300 rounded focus:ring-brand-primary cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                Acepto los{' '}
                <Link to="/legal/terminos-y-condiciones-de-uso" target="_blank" className="font-medium text-brand-primary hover:text-orange-600 underline decoration-orange-200 hover:decoration-orange-400">
                  Términos y Condiciones
                </Link>{' '}
                y la{' '}
                <Link to="/legal/politica-de-privacidad" target="_blank" className="font-medium text-brand-primary hover:text-orange-600 underline decoration-orange-200 hover:decoration-orange-400">
                  Política de Privacidad
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={!termsAccepted || loading}
              className="w-full py-3.5 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-200/40 hover:shadow-orange-300/60 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Registrando...' : 'Crear Cuenta'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500">
            ¿Ya tienes una cuenta?{' '}
            <button onClick={() => navigateTo('login')} className="font-semibold text-brand-primary hover:text-orange-600 transition-colors">
              Inicia Sesión
            </button>
          </p>
        </div>
      </div>

      {/* ═══ RIGHT: Visual Panel ═══ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500" />

        {/* Decorative circles */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-80 h-80 border-2 border-white/30 rounded-full" />
          <div className="absolute top-1/2 -left-20 w-96 h-96 border border-white/20 rounded-full" />
          <div className="absolute bottom-20 right-10 w-40 h-40 border border-white/25 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-white/90 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              100% Gratis para Clientes
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Tu hogar<br />merece lo<br />mejor.
            </h2>
            <p className="text-white/80 text-lg max-w-sm leading-relaxed">
              Accede a una red de profesionales verificados listos para resolver cualquier necesidad de tu hogar.
            </p>
          </div>

          {/* Features list */}
          <div className="space-y-4">
            {[
              'Profesionales verificados con KYC',
              'Pagos seguros con garantía',
              'Soporte dedicado 24/7',
              'Sin costos ocultos',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white/90 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientRegistrationForm;