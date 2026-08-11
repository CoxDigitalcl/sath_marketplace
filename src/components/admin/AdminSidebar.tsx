import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminView } from './AdminDashboard';
import {
    LayoutDashboard, Users, User, Repeat, DollarSign, ShieldAlert,
    MessageSquare, Settings, BarChart3, X, List, Star, Activity, Sparkles,
    Ticket, AlertTriangle, MessageCircle
} from 'lucide-react';
import { LogoIcon } from '../IconComponents';

interface AdminSidebarProps {
    activeView: AdminView;
    setActiveView: (view: AdminView) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const navItems = [
    { id: 'home', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'providers', label: 'Proveedores', icon: Users },
    { id: 'services', label: 'Servicios', icon: List },
    { id: 'clients', label: 'Clientes', icon: User },
    { id: 'transactions', label: 'Transacciones', icon: Repeat },
    { id: 'promotions', label: 'Promociones', icon: Star },
    { id: 'promotion-tiers', label: 'Planes de Promoción', icon: Sparkles },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'finance', label: 'Finanzas y Pagos', icon: DollarSign },
    { id: 'moderation', label: 'Moderación', icon: ShieldAlert },
    { id: 'tickets', label: 'Tickets de Soporte', icon: Ticket },
    { id: 'claims', label: 'Reclamos', icon: AlertTriangle },
    { id: 'system-health', label: 'Estado del Sistema', icon: Activity },
    { id: 'support', label: 'Soporte (Legacy)', icon: MessageSquare },
    { id: 'config', label: 'Configuración', icon: Settings },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];


const NavLink: React.FC<{
    item: typeof navItems[0];
    isActive: boolean;
    onClick: () => void;
}> = ({ item, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 ${isActive
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
        >
            <item.icon size={20} className="mr-3" />
            <span>{item.label}</span>
        </button>
    );
};


const SidebarContent: React.FC<Omit<AdminSidebarProps, 'isOpen' | 'setIsOpen'>> = ({ activeView, setActiveView }) => (
    <div className="flex flex-col h-full">
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <div className="flex items-center space-x-2 text-brand-dark">
                <LogoIcon className="h-8 w-8 text-brand-primary" />
                <span className="text-xl font-bold">Admin</span>
            </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
            {navItems.map(item => (
                <NavLink
                    key={item.id}
                    item={item}
                    isActive={activeView === item.id}
                    onClick={() => setActiveView(item.id as AdminView)}
                />
            ))}
        </nav>
    </div>
);


const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeView, setActiveView, isOpen, setIsOpen }) => {
    return (
        <>
            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed top-0 left-0 h-full w-64 bg-white z-50 md:hidden"
                        >
                            <SidebarContent activeView={activeView} setActiveView={(view) => {
                                setActiveView(view);
                                setIsOpen(false);
                            }} />
                            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                                <X size={24} />
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-64">
                    <div className="h-full bg-white border-r border-gray-200">
                        <SidebarContent activeView={activeView} setActiveView={setActiveView} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminSidebar;
