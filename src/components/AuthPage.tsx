import React from 'react';
import { Page } from '../types';
import { ArrowRightIcon, UserIcon, WrenchScrewdriverIcon } from './IconComponents';

interface AuthPageProps {
  navigateTo: (page: Page) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ navigateTo }) => {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center bg-brand-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Únete a nuestra comunidad</h2>
          <p className="mt-2 text-lg text-gray-600">
            Elige tu camino para comenzar. ¿Estás aquí para ofrecer tus habilidades o para encontrar un profesional?
          </p>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <button 
            onClick={() => navigateTo('provider-register')}
            className="group relative w-full flex flex-col items-center justify-center p-8 border-2 border-gray-300 border-dashed rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-all duration-300"
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-brand-primary/10 text-brand-primary">
              <WrenchScrewdriverIcon className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold text-gray-900">Soy un Proveedor</h3>
            <p className="mt-2 text-md text-gray-500 text-center">Ofrece tus servicios, gestiona tu perfil y haz crecer tu negocio.</p>
            <span className="mt-6 font-semibold text-brand-primary group-hover:text-orange-600 flex items-center">
              Registrarme como Proveedor <ArrowRightIcon className="ml-2 h-5 w-5" />
            </span>
          </button>
          
          <button 
            onClick={() => navigateTo('client-register')}
            className="group relative w-full flex flex-col items-center justify-center p-8 border-2 border-gray-300 border-dashed rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-all duration-300"
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-brand-primary/10 text-brand-primary">
              <UserIcon className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold text-gray-900">Soy un Cliente</h3>
            <p className="mt-2 text-md text-gray-500 text-center">Encuentra y contrata profesionales de confianza para cualquier trabajo.</p>
            <span className="mt-6 font-semibold text-brand-primary group-hover:text-orange-600 flex items-center">
              Registrarme como Cliente <ArrowRightIcon className="ml-2 h-5 w-5" />
            </span>
          </button>
        </div>
        
        <div className="text-center">
          <p className="text-md text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <button onClick={() => navigateTo('login')} className="font-medium text-brand-primary hover:text-orange-600">
              Inicia sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;