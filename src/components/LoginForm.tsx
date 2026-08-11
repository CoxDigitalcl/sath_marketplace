import React, { useState, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Page } from '../types';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Shield, Star, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginFormProps {
  navigateTo: (page: Page, params?: any) => void;
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

const LoginForm: React.FC<LoginFormProps> = ({ navigateTo }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const location = useLocation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.status === 'success') {
        const { token, user } = response.data;
        login(token, user);

        if (location.state?.returnTo) {
          navigateTo(location.state.returnTo as Page, location.state.returnState);
          return;
        }

        if (user.role === 'admin') navigateTo('admin-dashboard');
        else if (user.role === 'provider') navigateTo('provider-dashboard');
        else navigateTo('client-dashboard');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="w-full max-w-md mx-auto">
          <button 
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bienvenido de vuelta</h1>
            <p className="mt-2 text-gray-500 text-[15px]">
              Ingresa tus credenciales para acceder a tu cuenta.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <FloatingInput
              id="login-email"
              label="Correo Electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <FloatingInput
              id="login-password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              showToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-800 select-none">Recuérdame</span>
              </label>
              <button
                type="button"
                onClick={() => navigateTo('forgot-password')}
                className="text-sm font-medium text-brand-primary hover:text-orange-600 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-primary hover:bg-orange-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-200/40 hover:shadow-orange-300/60 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              ¿No tienes una cuenta?{' '}
              <button onClick={() => navigateTo('auth')} className="font-semibold text-brand-primary hover:text-orange-600 transition-colors">
                Regístrate gratis
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT: Visual Panel ═══ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700" />
        
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 border border-white/30 rounded-full" />
          <div className="absolute top-32 right-32 w-48 h-48 border border-white/20 rounded-full" />
          <div className="absolute bottom-40 left-20 w-60 h-60 border border-white/20 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Top */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-white/90 text-sm font-medium">
              <Shield className="w-4 h-4" />
              Plataforma Verificada y Segura
            </div>
          </div>

          {/* Center */}
          <div className="space-y-8">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Servicios<br />profesionales<br />a tu puerta.
            </h2>
            <p className="text-white/80 text-lg max-w-sm leading-relaxed">
              Encuentra profesionales verificados para todos los servicios de tu hogar. Seguro, confiable y sin complicaciones.
            </p>
          </div>

          {/* Bottom: Stats/Trust */}
          <div className="space-y-6">
            {/* Testimonial card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                ))}
              </div>
              <p className="text-white/90 text-sm leading-relaxed italic">
                "Increíble plataforma. Encontré un electricista certificado en minutos. 
                 Todo el proceso fue transparente y seguro."
              </p>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                  MR
                </div>
                <div>
                  <p className="text-white font-medium text-sm">María Rodríguez</p>
                  <p className="text-white/60 text-xs">Cliente Verificada</p>
                </div>
              </div>
            </div>

            {/* Trust stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: '500+', label: 'Profesionales' },
                { value: '15K+', label: 'Servicios' },
                { value: '4.8', label: 'Valoración' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-white/60 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;