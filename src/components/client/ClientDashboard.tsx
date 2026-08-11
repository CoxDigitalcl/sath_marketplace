
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Home, ChevronDown } from 'lucide-react';
import { ClientDashboardView } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import NotificationDropdown from '../common/NotificationDropdown';

import ClientSidebar from './ClientSidebar';

// Import view components
import ClientOrders from './views/ClientOrders';
import ClientScheduledServices from './views/ClientScheduledServices';
import ClientPurchasedProducts from './views/ClientPurchasedProducts';
import ClientFavorites from './views/ClientFavorites';
import ClientClaims from './views/ClientClaims';
import ClientBilling from './views/ClientBilling';
import ClientLegal from './views/ClientLegal';
import ChangePasswordSection from '../common/ChangePasswordSection';


const ClientDashboard: React.FC = () => {
    const location = useLocation();
    const navState = location.state as { view?: ClientDashboardView; preselectedBookingId?: string } | null;

    const [activeView, setActiveView] = useState<ClientDashboardView>(navState?.view || 'orders');
    const [preselectedBookingId, setPreselectedBookingId] = useState<string | undefined>(navState?.preselectedBookingId);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    // Handle navigation state changes (when navigating from orders to claims)
    useEffect(() => {
        if (navState?.view && navState.view !== activeView) {
            setActiveView(navState.view);
        }
        if (navState?.preselectedBookingId) {
            setPreselectedBookingId(navState.preselectedBookingId);
        }
    }, [navState]);

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
            case 'orders': return <ClientOrders />;
            case 'scheduled': return <ClientScheduledServices />;
            case 'products': return <ClientPurchasedProducts />;
            case 'favorites': return <ClientFavorites />;
            case 'claims': return <ClientClaims preselectedBookingId={preselectedBookingId} />;
            case 'billing': return <ClientBilling />;
            case 'legal': return <ClientLegal />;
            case 'security': return (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Seguridad</h1>
                        <p className="text-gray-600 mt-1">Administra la seguridad de tu cuenta.</p>
                    </div>
                    <ChangePasswordSection />
                </div>
            );
            default: return <ClientOrders />;
        }
    }

    // Get display name from user or fallback
    const displayName = user?.full_name || 'Cliente';

    return (
        <div className="flex h-screen bg-gray-100">
            <ClientSidebar activeView={activeView} setActiveView={setActiveView} isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-600">
                        <Menu size={24} />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800">Panel de Cliente</h1>
                    <div className="flex items-center space-x-4">
                        <NotificationDropdown />

                        {/* User Menu Dropdown */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
                            >
                                <img src="https://i.pravatar.cc/150?u=cli_a1b2" alt="Client Avatar" className="h-8 w-8 rounded-full" />
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

export default ClientDashboard;
