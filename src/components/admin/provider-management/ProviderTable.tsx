import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Provider } from '../views/ProviderManagement';
import StatusBadge from './StatusBadge';
import ToggleSwitch from './ToggleSwitch';
import { MoreVertical, Copy, Eye, LogIn, Send, Star } from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';

interface ProviderTableProps {
    providers: Provider[];
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number) => void;
    onViewProvider: (id: string) => void;
    onUpdateProvider?: (provider: Partial<Provider> & { id: string }) => void;
}

const ProviderTable: React.FC<ProviderTableProps> = ({ providers, currentPage, totalPages, setCurrentPage, onViewProvider, onUpdateProvider }) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const menuWidth = 224;
    const menuHeight = 196;

    const openProvider = useMemo(
        () => providers.find(provider => provider.id === openMenuId) || null,
        [openMenuId, providers]
    );

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-CL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleTogglePayouts = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            const newStatus = !currentStatus;
            await api.put(`/admin/providers/${id}/payouts`, { enabled: newStatus });

            if (onUpdateProvider) {
                onUpdateProvider({ id, payoutsEnabled: newStatus });
            }
        } catch (err) {
            toast.error('Error al actualizar el estado de pagos.');
        }
    };

    const updateMenuPosition = (providerId: string) => {
        const button = menuButtonRefs.current[providerId];
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const safeMargin = 16;
        const left = Math.min(
            window.innerWidth - menuWidth - safeMargin,
            Math.max(safeMargin, rect.right - menuWidth)
        );
        const hasRoomBelow = window.innerHeight - rect.bottom > menuHeight + safeMargin;
        const top = hasRoomBelow
            ? rect.bottom + 8
            : Math.max(safeMargin, rect.top - menuHeight - 8);

        setMenuPosition({ top, left });
    };

    const toggleMenu = (providerId: string, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();

        if (openMenuId === providerId) {
            setOpenMenuId(null);
            return;
        }

        setOpenMenuId(providerId);
        requestAnimationFrame(() => updateMenuPosition(providerId));
    };

    useEffect(() => {
        if (!openMenuId) return;

        const closeMenu = () => setOpenMenuId(null);
        const reposition = () => updateMenuPosition(openMenuId);
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            const button = menuButtonRefs.current[openMenuId];
            const menu = document.getElementById(`provider-actions-menu-${openMenuId}`);

            if (button?.contains(target) || menu?.contains(target)) return;
            closeMenu();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu();
        };

        reposition();
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [openMenuId]);

    const handleViewProvider = (provider: Provider) => {
        setOpenMenuId(null);
        onViewProvider(provider.id);
    };

    const handleCopyProviderId = (provider: Provider) => {
        navigator.clipboard.writeText(provider.id);
        toast.success('ID copiado al portapapeles.');
        setOpenMenuId(null);
    };

    const handleSendMessage = (provider: Provider) => {
        const subject = encodeURIComponent(`[Serviciosatuhogar Admin] Mensaje para ${provider.storeName}`);
        const body = encodeURIComponent(`Hola ${provider.storeName},\n\nEste es un mensaje del equipo de administracion de Serviciosatuhogar.\n\n[Escribe tu mensaje aqui]\n\nSaludos,\nEquipo Serviciosatuhogar`);
        window.open(`mailto:${provider.ownerEmail}?subject=${subject}&body=${body}`, '_blank');
        setOpenMenuId(null);
    };

    const handleImpersonateProvider = async (provider: Provider) => {
        if (!confirm(`Seguro que deseas actuar como ${provider.storeName}? Se abrira una nueva sesion.`)) {
            return;
        }

        try {
            const res = await api.post(`/admin/impersonate/${provider.id}`);
            if (res.data.status === 'success') {
                localStorage.setItem('auth_token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));

                const targetUrl = res.data.user.role === 'provider'
                    ? '/provider'
                    : '/';

                toast.success(`Ahora estas actuando como ${res.data.user.email}. La pagina se recargara.`);
                window.location.href = targetUrl;
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al impersonar usuario');
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-x-auto min-h-[400px]">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Tienda</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos (30d)</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payouts</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Registro</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {providers.map(provider => (
                            <tr key={provider.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <img className="h-10 w-10 rounded-full object-cover" src={provider.avatarUrl} alt={provider.storeName} />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{provider.storeName}</div>
                                            <div className="text-sm text-gray-500">
                                                {provider.ownerEmail}
                                                {(provider as any).rut && !(provider as any).rut.startsWith('TEMP-') && ` | ${(provider as any).rut}`}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusBadge status={provider.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">{formatCurrency(provider.income30d)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="inline-flex items-center gap-1">
                                        {provider.rating.toFixed(1)}
                                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div onClick={(e) => handleTogglePayouts(provider.id, provider.payoutsEnabled, e)}>
                                        <ToggleSwitch enabled={provider.payoutsEnabled} onChange={() => { }} />
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(provider.registrationDate)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        ref={(node) => { menuButtonRefs.current[provider.id] = node; }}
                                        type="button"
                                        onClick={(e) => toggleMenu(provider.id, e)}
                                        aria-haspopup="menu"
                                        aria-expanded={openMenuId === provider.id}
                                        className={`p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors ${openMenuId === provider.id ? 'bg-gray-100 text-gray-800' : ''}`}
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {providers.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-gray-500">
                                    No se encontraron proveedores con los filtros actuales.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {typeof document !== 'undefined' && openProvider && createPortal(
                <div
                    id={`provider-actions-menu-${openProvider.id}`}
                    className="fixed w-56 rounded-md shadow-xl bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-[1000]"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                    role="menu"
                    aria-orientation="vertical"
                >
                    <div className="py-1">
                        <button onClick={() => handleViewProvider(openProvider)} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem"><Eye size={16} className="mr-3" />Ver Perfil Detallado</button>
                        <button
                            onClick={() => handleCopyProviderId(openProvider)}
                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                        >
                            <Copy size={16} className="mr-3" />Copiar ID
                        </button>
                        <button
                            onClick={() => handleSendMessage(openProvider)}
                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                        >
                            <Send size={16} className="mr-3" />Enviar Mensaje
                        </button>
                        <div className="border-t my-1"></div>
                        <button
                            onClick={() => handleImpersonateProvider(openProvider)}
                            className="w-full text-left flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                            role="menuitem"
                        >
                            <LogIn size={16} className="mr-3" />Impersonar Usuario
                        </button>
                    </div>
                </div>,
                document.body
            )}

            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                    <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                    <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Siguiente</button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div><p className="text-sm text-gray-700">Pagina <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span></p></div>
                    <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                            <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                            <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Siguiente</button>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProviderTable;
