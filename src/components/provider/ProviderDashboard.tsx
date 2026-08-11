
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Home, ChevronDown } from 'lucide-react';
import { ProviderDashboardView } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import NotificationDropdown from '../common/NotificationDropdown';

import ProviderSidebar from './ProviderSidebar';

// Import view components
import ProviderDashboardHome from './views/ProviderDashboardHome';
import ProviderServices from './views/ProviderServices';
import ProviderProducts from './views/ProviderProducts';
import ProviderOrders from './views/ProviderOrders';
import ProviderFinance from './views/ProviderFinance';
import ProviderProfile from './views/ProviderProfile';
import ProviderSupport from './views/ProviderSupport';
import ProviderLegal from './views/ProviderLegal';

const ProviderDashboard: React.FC = () => {
    const [activeView, setActiveView] = useState<ProviderDashboardView>('home');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const renderView = () => {
        switch (activeView) {
            case 'home': return <ProviderDashboardHome navigateTo={setActiveView} />;
            case 'services': return <ProviderServices />;
            case 'products': return <ProviderProducts />;
            case 'orders': return <ProviderOrders />;
            case 'finance': return <ProviderFinance />;
            case 'profile': return <ProviderProfile />;
            case 'support': return <ProviderSupport />;
            case 'legal': return <ProviderLegal />;
            default: return <ProviderDashboardHome />;
        }
    }

    // Get display name from user or fallback
    const displayName = user?.full_name || 'Proveedor';

    return (
        <div className="flex h-screen bg-gray-100">
            <ProviderSidebar activeView={activeView} setActiveView={setActiveView} isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-600">
                        <Menu size={24} />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800">Panel de Proveedor</h1>
                    <div className="flex items-center space-x-4">
                        <NotificationDropdown />

                        {/* User Menu Dropdown */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
                            >
                                {user?.profile_image_url ? (
                                    <img src={user.profile_image_url} alt="Provider Avatar" className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span className="text-sm font-medium text-gray-700 hidden sm:block">{displayName}</span>
                                <ChevronDown size={16} className={`text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                    <Link
                                        to="/"
                                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                        onClick={() => setUserMenuOpen(false)}
                                    >
                                        <Home size={16} />
                                        <span>Ir al Sitio Público</span>
                                    </Link>
                                    <hr className="my-1 border-gray-200" />
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        <span>Cerrar Sesión</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6 lg:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default ProviderDashboard;
