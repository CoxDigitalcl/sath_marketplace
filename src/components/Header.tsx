import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../types';
import { LogoIcon, SearchIcon } from './IconComponents';
import { useAuthStore } from '../stores/authStore';
import { User, LogOut, LayoutDashboard, ChevronDown, Menu, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationCoverageSelector from './common/LocationCoverageSelector';
import { getRegionByCode } from '../../shared/chileLocations.js';

interface HeaderProps {
  navigateTo: (page: Page, params?: any) => void;
}

const Header: React.FC<HeaderProps> = ({ navigateTo }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegionCode, setSelectedRegionCode] = useState('');
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
  const [isLocationMenuOpen, setLocationMenuOpen] = useState(false);
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = useAuthStore();
  const selectedRegion = selectedRegionCode ? getRegionByCode(selectedRegionCode) : null;
  const locationLabel = selectedCommunes.length > 1
    ? selectedCommunes.length + ' comunas'
    : selectedCommunes[0] || (selectedRegion ? selectedRegion.name.replace(/^Region de\s+/i, 'Reg. ') : 'Ubicacion');

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (locationMenuRef.current && !locationMenuRef.current.contains(event.target as Node)) {
        setLocationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = {
      q: searchTerm.trim(),
      region: selectedRegionCode,
      communes: selectedRegionCode ? selectedCommunes : [],
    };

    if (searchTerm.trim()) {
      navigateTo('search', params);
      setSearchTerm('');
    } else {
      navigateTo('search', params);
    }
  };

  const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'provider' ? '/provider/dashboard' : '/client/dashboard';

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-gray-100 transition-all duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="transform transition-transform group-hover:scale-105 duration-300">
                <LogoIcon className="h-9 w-9 text-brand-primary" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-dark to-brand-primary hidden sm:block">
                Serviciosatuhogar
              </span>
            </Link>
          </div>

          {/* Search Bar (Visible on medium screens and up) */}
          <div className="hidden md:block flex-grow max-w-2xl mx-8 lg:mx-12">
            <form onSubmit={handleSearch} className="relative group">
              <div className="flex w-full items-center rounded-full border border-gray-200 bg-gray-50 shadow-sm transition-all duration-300 group-hover:bg-white focus-within:border-brand-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-primary/20">
              <input
                type="text"
                placeholder="¿Qué servicio buscas hoy?"
                className="min-w-0 flex-1 bg-transparent py-2.5 pl-5 pr-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div ref={locationMenuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setLocationMenuOpen((open) => !open)}
                  className="mx-1 inline-flex max-w-44 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-brand-primary hover:text-brand-primary"
                >
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">{locationLabel}</span>
                </button>

                {isLocationMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-96 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
                    <LocationCoverageSelector
                      regionCode={selectedRegionCode}
                      communes={selectedCommunes}
                      onRegionChange={setSelectedRegionCode}
                      onCommunesChange={setSelectedCommunes}
                      mode="multiple"
                      label="Buscar por ubicacion"
                      helperText="Selecciona una o mas comunas para filtrar resultados."
                    />
                  </div>
                )}
              </div>
              <button type="submit" className="mr-2 p-1.5 bg-brand-primary rounded-full text-white hover:bg-brand-accent transition-colors shadow-sm">
                <SearchIcon className="h-4 w-4" />
              </button>
              </div>
            </form>
          </div>

          {/* Navigation Links */}
          <div className="hidden lg:flex lg:items-center lg:space-x-8">
            <nav className="flex items-center space-x-6">
              <Link to="/search"
                className="text-gray-600 hover:text-brand-primary font-medium transition-colors duration-200 text-[15px] relative group"
              >
                Explorar
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary transition-all duration-300 group-hover:w-full"></span>
              </Link>
              <Link to="/categories"
                className="text-gray-600 hover:text-brand-primary font-medium transition-colors duration-200 text-[15px] relative group"
              >
                Categorías
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </nav>

            <div className="h-6 w-px bg-gray-200"></div>

            {isAuthenticated ? (
              <div className="relative ml-2" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 hover:bg-gray-50 rounded-full pl-2 pr-4 py-1.5 transition-all duration-200 border border-transparent hover:border-gray-200"
                >
                  <div className="h-9 w-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-semibold">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={20} />}
                  </div>
                  <div className="text-left hidden xl:block">
                    <p className="text-sm font-semibold text-gray-700 leading-none">{user?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500 mt-1 capitalize">{user?.role === 'admin' ? 'Administrador' : user?.role === 'provider' ? 'Proveedor' : 'Cliente'}</p>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <div className={`absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 transform transition-all duration-200 origin-top-right ${isUserMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                  <div className="px-4 py-3 border-b border-gray-50 xl:hidden">
                    <p className="text-sm font-semibold text-gray-800">{user?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>

                  <div className="py-1">
                    <Link to={dashboardPath} onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-primary transition-colors"
                    >
                      <LayoutDashboard size={18} />
                      <span>Mi Panel</span>
                    </Link>
                    {/* Add Profile link later if needed */}
                  </div>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); navigateTo('home'); }}
                    className="flex items-center space-x-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/provider/register"
                  className="text-gray-600 hover:text-brand-primary font-medium transition-colors duration-300 text-[15px]"
                >
                  Quiero ser proveedor
                </Link>
                <Link to="/login"
                  className="bg-brand-primary hover:bg-brand-accent text-white font-semibold py-2.5 px-6 rounded-full transition-all duration-300 transform hover:shadow-lg hover:-translate-y-0.5 text-[15px]"
                >
                  Iniciar Sesión
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button - Animado */}
          <div className="lg:hidden flex items-center space-x-2 z-50">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-700 hover:text-brand-primary transition-colors focus:outline-none"
              aria-label="Abrir menú"
            >
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>


        </div>
      </div>
    </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[85%] sm:w-80 bg-white/95 backdrop-blur-md shadow-2xl z-50 flex flex-col lg:hidden border-l border-white/20"
            >
              <div className="p-6 flex flex-col h-full overflow-y-auto no-scrollbar">
                {/* Drawer Header */}
                <div className="flex justify-between items-center mb-8">
                  <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-brand-primary">
                    Menú
                  </span>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 hover:text-brand-primary p-2 bg-gray-50 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                {/* Mobile Search */}
                <div className="mb-8">
                  <form onSubmit={(e) => { e.preventDefault(); navigateTo('search', { q: searchTerm.trim(), region: selectedRegionCode, communes: selectedRegionCode ? selectedCommunes : [] }); setSearchTerm(''); setIsMobileMenuOpen(false); }} className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar servicios..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-gray-50 focus:bg-white transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    </div>
                    <LocationCoverageSelector
                      regionCode={selectedRegionCode}
                      communes={selectedCommunes}
                      onRegionChange={setSelectedRegionCode}
                      onCommunesChange={setSelectedCommunes}
                      mode="multiple"
                      label="Ubicacion"
                      helperText="Opcional, filtra por una o mas comunas."
                    />
                    <button type="submit" className="w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-accent">
                      Buscar
                    </button>
                  </form>
                </div>

                {/* Navigation Links with Micro-animations */}
                <div className="flex flex-col space-y-2 flex-grow">
                   <Link to="/search" onClick={() => setIsMobileMenuOpen(false)}
                      className="text-left text-lg font-semibold text-gray-700 hover:text-brand-primary py-3 px-2 rounded-lg hover:bg-brand-primary/5 transition-colors"
                    >
                      Explorar
                    </Link>
                    <Link to="/categories" onClick={() => setIsMobileMenuOpen(false)}
                      className="text-left text-lg font-semibold text-gray-700 hover:text-brand-primary py-3 px-2 rounded-lg hover:bg-brand-primary/5 transition-colors"
                    >
                       Categorías
                    </Link>
                </div>

                {/* Footer and Session Actions */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  {isAuthenticated ? (
                     <div className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-3 mb-4 p-2 bg-gray-50 rounded-xl">
                           <div className="h-10 w-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold shadow-sm">
                             {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={20} />}
                           </div>
                           <div>
                             <p className="font-semibold text-gray-800 leading-tight">{user?.full_name || 'Usuario'}</p>
                             <p className="text-xs text-brand-primary font-medium capitalize">{user?.role === 'admin' ? 'Administrador' : user?.role === 'provider' ? 'Proveedor' : 'Cliente'}</p>
                           </div>
                        </div>
                        <Link to={dashboardPath} onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center space-x-3 text-gray-700 py-3 px-2 rounded-lg hover:bg-gray-50 hover:text-brand-primary font-medium transition-colors"
                        >
                          <LayoutDashboard size={20} className="text-gray-400" /> <span>Mi Panel</span>
                        </Link>
                        <motion.button
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                          onClick={() => { logout(); navigateTo('home'); setIsMobileMenuOpen(false); }}
                          className="flex items-center space-x-3 text-red-600 py-3 px-2 rounded-lg hover:bg-red-50 font-medium transition-colors"
                        >
                          <LogOut size={20} className="text-red-400" /> <span>Cerrar Sesión</span>
                        </motion.button>
                     </div>
                  ) : (
                     <div className="flex flex-col space-y-3">
                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}
                          className="w-full bg-brand-primary hover:bg-brand-accent text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-center flex items-center justify-center space-x-2"
                        >
                          <User size={18} /><span>Iniciar Sesión</span>
                        </Link>
                        <Link to="/provider/register" onClick={() => setIsMobileMenuOpen(false)}
                          className="w-full bg-orange-50 text-orange-600 font-bold py-3.5 rounded-xl transition-all hover:bg-orange-100 active:scale-95 text-center"
                        >
                          Quiero ser proveedor
                        </Link>
                     </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
