import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Home, ChevronDown } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import NotificationDropdown from '../common/NotificationDropdown';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

// Import view components
import DashboardHome from './views/DashboardHome';
import ProviderManagement from './views/ProviderManagement';
import ClientManagement from './views/ClientManagement';
import TransactionEngine from './views/TransactionEngine';
import FinancePayouts from './views/FinancePayouts';
import ContentModeration from './views/ContentModeration';
import SupportTickets from './views/SupportTickets';
import AdminTickets from './views/AdminTickets';
import AdminClaims from './views/AdminClaims';
import MarketplaceConfig from './views/MarketplaceConfig';
import AdvancedAnalytics from './views/AdvancedAnalytics';
import AdminServices from './views/AdminServices';
import AdminPromotions from './views/AdminPromotions';
import AdminPromotionTiers from './views/AdminPromotionTiers';
import WhatsAppSettings from './views/WhatsAppSettings';
import SystemHealthWidget from './SystemHealthWidget';

export type AdminView =
    | 'home'
    | 'providers'
    | 'clients'
    | 'transactions'
    | 'finance'
    | 'moderation'
    | 'support'
    | 'tickets'
    | 'claims'
    | 'config'
    | 'analytics'
    | 'services'
    | 'promotions'
    | 'promotion-tiers'
    | 'whatsapp'
    | 'system-health';

const AdminDashboard: React.FC = () => {
    const [activeView, setActiveView] = useState<AdminView>('config');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { user, token, logout } = useAuthStore();

    // Protect Route
    useEffect(() => {
        // Double check against localStorage in case zustand hasn't rehydrated yet
        const storedAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        const activeToken = token || storedAuth.state?.token || localStorage.getItem('auth_token');
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
            case 'home': return <DashboardHome setActiveView={setActiveView} />;
            case 'providers': return <ProviderManagement />;
            case 'clients': return <ClientManagement />;
            case 'transactions': return <TransactionEngine />;
            case 'finance': return <FinancePayouts />;
            case 'moderation': return <ContentModeration setActiveView={setActiveView} />;
            case 'support': return <SupportTickets />;
            case 'tickets': return <AdminTickets />;
            case 'claims': return <AdminClaims />;
            case 'config': return <MarketplaceConfig />;
            case 'analytics': return <AdvancedAnalytics />;
            case 'services': return <AdminServices />;
            case 'promotions': return <AdminPromotions />;
            case 'promotion-tiers': return <AdminPromotionTiers />;
            case 'whatsapp': return <WhatsAppSettings />;
            case 'system-health': return <div className="max-w-6xl mx-auto"><SystemHealthWidget /></div>; // Wrapped for layout
            default: return <DashboardHome setActiveView={setActiveView} />;
        }
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <AdminSidebar activeView={activeView} setActiveView={setActiveView} isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-600">
                        <Menu size={24} />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800">Panel de Administración</h1>
                    <div className="flex items-center space-x-4">
                        <NotificationDropdown />

                        {/* User Menu Dropdown */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
                            >
                                <User size={20} className="text-gray-500" />
                                <span className="text-sm font-medium text-gray-700 hidden sm:block">Admin</span>
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

                {/* Main Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6 lg:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
