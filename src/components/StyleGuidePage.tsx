
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const colors = [
  { name: 'Primary', className: 'bg-brand-primary', hex: '#FF6B00' },
  { name: 'Secondary', className: 'bg-brand-secondary', hex: '#334155' },
  { name: 'Accent', className: 'bg-brand-accent', hex: '#2edef5' },
  { name: 'Dark', className: 'bg-brand-dark', hex: '#0D1117' },
  { name: 'Light', className: 'bg-brand-light', hex: '#F8FAFC' },
];

const ColorSwatch: React.FC<{ color: typeof colors[0] }> = ({ color }) => (
  <div className="flex flex-col">
    <div className={`h-24 w-full rounded-lg shadow-inner ${color.className}`}></div>
    <div className="mt-2 text-center">
      <p className="font-bold text-gray-800">{color.name}</p>
      <p className="text-sm text-gray-500 font-mono">{color.hex}</p>
      <p className="text-xs text-gray-400 font-mono">{`brand-${color.name.toLowerCase()}`}</p>
    </div>
  </div>
);

const StyleGuidePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  useEffect(() => {
    const storedAuth = JSON.parse(sessionStorage.getItem('auth-storage') || '{}');
    const activeToken = token || storedAuth.state?.token || sessionStorage.getItem('auth_token');
    const activeUser = user || storedAuth.state?.user;

    if (!activeToken) {
      navigate('/login');
      return;
    }

    if (activeUser && activeUser.role !== 'admin') {
      toast.error("No tienes permisos de administrador.");
      navigate('/');
    }
  }, [token, user, navigate]);

  return (
    <div className="bg-brand-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900">Guía de Estilos de Serviciosatuhogar</h1>
          <p className="mt-2 text-lg text-gray-600">Referencia visual para colores, tipografía y componentes de la interfaz.</p>
        </div>

        {/* Color Palette Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-gray-200">Paleta de Colores</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {colors.map(color => (
              <ColorSwatch key={color.name} color={color} />
            ))}
          </div>
        </section>

        {/* Typography Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-gray-200">Tipografía</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">Fuente principal: Inter Tight</p>
            <h1 className="text-5xl font-extrabold">Heading 1</h1>
            <h2 className="text-4xl font-bold">Heading 2</h2>
            <h3 className="text-3xl font-bold">Heading 3</h3>
            <h4 className="text-2xl font-semibold">Heading 4</h4>
            <h5 className="text-xl font-semibold">Heading 5</h5>
            <h6 className="text-lg font-medium">Heading 6</h6>
            <p className="text-base">
              Este es un párrafo de texto estándar. Se utiliza para la mayoría del contenido escrito en la plataforma.
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <a href="#" className="text-brand-primary hover:underline">Este es un enlace de ejemplo.</a>
          </div>
        </section>

        {/* Components Section */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-gray-200">Componentes (Botones)</h2>
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex flex-col items-center space-y-2">
              <p className="font-medium text-sm">Botón Primario</p>
              <button className="bg-brand-primary hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-md">
                Publicar servicio
              </button>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <p className="font-medium text-sm">Botón Secundario</p>
              <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md">
                Atrás
              </button>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <p className="font-medium text-sm">Botón de Texto</p>
              <button className="font-medium text-brand-primary hover:text-orange-600">
                Inicia sesión aquí
              </button>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <p className="font-medium text-sm">Botón con Sombra</p>
              <button className="bg-brand-primary hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-md transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md">
                Publicar servicio
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default StyleGuidePage;
