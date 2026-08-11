import React, { useState, useEffect } from 'react';
import { Client } from './ClientManagement';
import ClientStatusBadge from '../client-management/ClientStatusBadge';
import {
    ArrowLeft, AlertTriangle, DollarSign, ShoppingCart, Percent, BarChart2, ShieldQuestion,
    ListOrdered, Landmark, CreditCard, Activity,
    ShieldOff, ShieldCheck, KeyRound, Tag, Trash2, MessageSquare, Loader2, X
} from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';

// Helper: Authenticated fetch for admin endpoints
const adminFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
};




interface ClientProfileProps {
    client: Client;
    onBack: () => void;
}

type Tab = 'summary' | 'orders' | 'claims' | 'payments' | 'activity';

interface ClientStats {
    orders: any[];
    claims: any[];
    paymentMethods: any[];
    activityLog: any[];
}

// --- Sub-components ---

const KpiCard: React.FC<{ title: string; value: string; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-md mr-4"><Icon className="h-6 w-6 text-gray-600" /></div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    </div>
);

const Countdown: React.FC<{ to: string }> = ({ to }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const deadline = new Date(to).getTime();
            const now = new Date().getTime();
            const distance = deadline - now;
            if (distance < 0) { setTimeLeft('VENCIDO'); setIsUrgent(true); clearInterval(interval); return; }
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${days}d ${hours}h ${minutes}m`);
            setIsUrgent(days < 3);
        }, 1000);
        return () => clearInterval(interval);
    }, [to]);

    return <span className={isUrgent ? 'font-bold text-red-600' : 'text-gray-700'}>{timeLeft}</span>;
};

// --- Coupon Modal ---
interface CouponModalProps {
    onClose: () => void;
    onApply: (type: string, value: number, days: number) => void;
    loading: boolean;
}
const CouponModal: React.FC<CouponModalProps> = ({ onClose, onApply, loading }) => {
    const [type, setType] = useState('percent');
    const [value, setValue] = useState('');
    const [days, setDays] = useState('30');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Aplicar Cupón Manual</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de descuento</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                            <option value="percent">Porcentaje (%)</option>
                            <option value="fixed">Monto fijo (CLP)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Valor ({type === 'percent' ? '%' : 'CLP'})
                        </label>
                        <input
                            type="number"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            min="1"
                            max={type === 'percent' ? '100' : undefined}
                            placeholder={type === 'percent' ? 'Ej: 15' : 'Ej: 5000'}
                            className="w-full p-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Validez (días)</label>
                        <input
                            type="number"
                            value={days}
                            onChange={e => setDays(e.target.value)}
                            min="1"
                            max="365"
                            className="w-full p-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <button
                        disabled={!value || parseFloat(value) <= 0 || loading}
                        onClick={() => onApply(type, parseFloat(value), parseInt(days))}
                        className="w-full bg-brand-primary text-white font-semibold py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Tag size={16} className="mr-2" />}
                        Aplicar Cupón
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

const ClientProfile: React.FC<ClientProfileProps> = ({ client, onBack }) => {
    const [activeTab, setActiveTab] = useState<Tab>(client.hasSernacClaim ? 'claims' : 'summary');
    const [stats, setStats] = useState<ClientStats>({ orders: [], claims: [], paymentMethods: [], activityLog: [] });
    const [loading, setLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showCouponModal, setShowCouponModal] = useState(false);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

    const getToken = () => {
        try {
            return JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
        } catch { return null; }
    };

    useEffect(() => {
        const fetchClientProfile = async () => {
            try {
                const token = getToken();
                const response = await adminFetch(`/api/admin/clients/${client.id}/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const res = await response.json();
                    setStats(res.data);
                }
            } catch (error) {
                // silently fail — table data shows empty state
            } finally {
                setLoading(false);
            }
        };

        // Fetch current block status
        const fetchBlockStatus = async () => {
            try {
                const res = await api.get(`/admin/clients/${client.id}/profile`);
                // is_blocked comes from the users table but is not in the profile endpoint yet — default to false
                setIsBlocked(client.status === 'blocked' || client.status === 'suspended');
            } catch { /* silent */ }
        };

        fetchClientProfile();
        fetchBlockStatus();
    }, [client.id, client.status]);

    // Handler for all quick actions
    const handleAction = async (actionId: string) => {
        const token = getToken();
        const authHeader = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        switch (actionId) {
            case 'block': {
                const label = isBlocked ? 'desbloquear' : 'bloquear';
                if (!window.confirm(`¿Confirmas que deseas ${label} la cuenta de ${client.nombre}?`)) return;
                setActionLoading('block');
                try {
                    const res = await adminFetch(`/api/admin/clients/${client.id}/block`, { method: 'PUT', headers: authHeader });
                    const data = await res.json();
                    if (data.status === 'success') {
                        setIsBlocked(data.data.is_blocked);
                        toast.success(data.message);
                    } else {
                        toast.error(data.message || 'Error al actualizar estado.');
                    }
                } catch {
                    toast.error('Error de conexión al bloquear la cuenta.');
                } finally {
                    setActionLoading(null);
                }
                break;
            }

            case 'reset_pass': {
                if (!window.confirm(`¿Forzar un reset de password para ${client.email}? Se generará un enlace válido por 24 horas.`)) return;
                setActionLoading('reset_pass');
                try {
                    const res = await adminFetch(`/api/admin/clients/${client.id}/force-reset-password`, { method: 'POST', headers: authHeader });
                    const data = await res.json();
                    if (data.status === 'success') {
                        toast.success(`Token generado. Enlace copiado al portapapeles.`, { duration: 5000 });
                        navigator.clipboard.writeText(data.data.resetLink).catch(() => { });
                    } else {
                        toast.error(data.message || 'Error al generar token.');
                    }
                } catch {
                    toast.error('Error de conexión.');
                } finally {
                    setActionLoading(null);
                }
                break;
            }

            case 'add_coupon': {
                setShowCouponModal(true);
                break;
            }

            case 'delete_data': {
                const c1 = window.confirm(`⚠️ ACCIÓN IRREVERSIBLE\n\n¿Deseas anonimizar los datos de ${client.nombre} según la Ley 19.628?\n\nEsta acción eliminará su email, contraseña y bloqueará la cuenta permanentemente.`);
                if (!c1) return;
                const c2 = window.confirm(`Segunda confirmación requerida.\n¿Confirmas la eliminación de datos de "${client.email}"?`);
                if (!c2) return;
                setActionLoading('delete_data');
                try {
                    const res = await adminFetch(`/api/admin/clients/${client.id}/data`, { method: 'DELETE', headers: authHeader });
                    const data = await res.json();
                    if (data.status === 'success') {
                        toast.success(data.message);
                        setTimeout(() => onBack(), 2000);
                    } else {
                        toast.error(data.message || 'Error al eliminar datos.');
                    }
                } catch {
                    toast.error('Error de conexión.');
                } finally {
                    setActionLoading(null);
                }
                break;
            }

            case 'send_message': {
                const subject = encodeURIComponent(`[Serviciosatuhogar] Mensaje para ${client.nombre}`);
                const body = encodeURIComponent(`Hola ${client.nombre},\n\nEste es un mensaje del equipo de Serviciosatuhogar.\n\n[Escribe tu mensaje aquí]\n\nSaludos,\nEquipo Serviciosatuhogar`);
                window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
                break;
            }
        }
    };

    const handleApplyCoupon = async (type: string, value: number, days: number) => {
        const token = getToken();
        setActionLoading('add_coupon');
        try {
            const res = await adminFetch(`/api/admin/clients/${client.id}/apply-coupon`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ discount_type: type, discount_value: value, expires_in_days: days })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success(`${data.message} — Código: ${data.data.code}`);
                setShowCouponModal(false);
            } else {
                toast.error(data.message || 'Error al aplicar cupón.');
            }
        } catch {
            toast.error('Error de conexión.');
        } finally {
            setActionLoading(null);
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'summary', label: 'Resumen', icon: BarChart2 },
        { id: 'orders', label: 'Órdenes', icon: ListOrdered },
        { id: 'claims', label: 'Reclamos (SERNAC)', icon: Landmark },
        { id: 'payments', label: 'Medios de Pago', icon: CreditCard },
        { id: 'activity', label: 'Actividad', icon: Activity },
    ];

    // Dynamic actions based on block state
    const actions = [
        {
            id: 'block',
            label: isBlocked ? 'Desbloquear Cuenta' : 'Bloquear Cuenta',
            icon: isBlocked ? ShieldCheck : ShieldOff,
            color: isBlocked ? 'text-gray-500' : 'text-red-600'
        },
        { id: 'reset_pass', label: 'Forzar Reset Password', icon: KeyRound, color: 'text-yellow-600' },
        { id: 'add_coupon', label: 'Aplicar Cupón Manual', icon: Tag, color: 'text-green-600' },
        { id: 'delete_data', label: 'Borrar Datos (Ley 19.628)', icon: Trash2, color: 'text-gray-600' },
        { id: 'send_message', label: 'Enviar Mensaje', icon: MessageSquare, color: 'text-blue-600' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'summary':
                return (
                    <div className="space-y-6">
                        {client.hasSernacClaim && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                                <div className="flex"><div className="flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
                                    <div className="ml-3"><p className="text-sm text-red-700">Este cliente tiene un reclamo SERNAC abierto. <button onClick={() => setActiveTab('claims')} className="font-medium underline">Revisar ahora</button></p></div></div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="LTV" value={formatCurrency(client.ltv)} icon={DollarSign} />
                            <KpiCard title="Órdenes Totales" value={client.totalOrders.toString()} icon={ShoppingCart} />
                            <KpiCard title="Tasa de Reclamos" value={`${(client.complaintRate * 100).toFixed(1)}%`} icon={Percent} />
                            <KpiCard title="Fraude Score" value={client.fraudScore.toString()} icon={ShieldQuestion} />
                        </div>
                    </div>
                );
            case 'orders':
                return (
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4">Historial de Órdenes</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50"><tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                </tr></thead>
                                <tbody className="bg-white divide-y divide-gray-200">{stats.orders.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No hay órdenes registradas.</td></tr>
                                ) : stats.orders.map(o => (
                                    <tr key={o.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{o.id.substring(0, 8).toUpperCase()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{o.providerName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(o.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(o.amount)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${o.status === 'completed' || o.status === 'released' || o.status === 'service_completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{o.status}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'claims':
                return (
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><Landmark size={20} className="mr-2" />Reclamos Formales (SERNAC)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50"><tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° SERNAC</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plazo para responder</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                                </tr></thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stats.claims.length === 0 ? (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay reclamos registrados.</td></tr>
                                    ) : stats.claims.filter(c => c.status !== 'Cerrado').map(claim => {
                                        const deadline = new Date(claim.deadline);
                                        const isUrgent = (deadline.getTime() - new Date().getTime()) < 3 * 24 * 60 * 60 * 1000;
                                        return (
                                            <tr key={claim.id} className={isUrgent ? 'bg-red-50 border-l-4 border-red-500' : ''}>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{claim.id}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(claim.date).toLocaleDateString()}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(claim.amount)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm"><Countdown to={claim.deadline} /></td>
                                                <td className="px-4 py-4 whitespace-nowrap"><button className="text-sm font-medium bg-brand-primary text-white py-1 px-3 rounded-md hover:opacity-90">Ver Detalles</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'payments':
                return (
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4">Medios de Pago Guardados</h3>
                        <ul className="divide-y divide-gray-200">
                            {stats.paymentMethods.length === 0 ? (
                                <li className="py-8 text-center text-gray-500">Sin medios de pago guardados.</li>
                            ) : stats.paymentMethods.map(pm => (
                                <li key={pm.id} className="py-3 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <CreditCard size={24} className="text-gray-400 mr-4" />
                                        <div>
                                            <p className="font-medium text-gray-900">{pm.type} terminada en •••• {pm.last4}</p>
                                            <p className="text-sm text-gray-500">Vence: {pm.expires}</p>
                                        </div>
                                    </div>
                                    {pm.isFlagged && <span className="text-xs font-bold text-red-600 flex items-center"><AlertTriangle size={14} className="mr-1" />REPORTADA</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 'activity':
                return (
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4">Actividad de la Cuenta</h3>
                        <ul className="divide-y divide-gray-200">
                            {stats.activityLog.length === 0 ? (
                                <li className="py-8 text-center text-gray-500">Sin registros de actividad recientes.</li>
                            ) : stats.activityLog.map(log => (
                                <li key={log.id} className="py-3">
                                    <p className="text-sm text-gray-800">{log.action}</p>
                                    <p className="text-xs text-gray-500">{log.timestamp} - {log.device}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Coupon Modal */}
            {showCouponModal && (
                <CouponModal
                    onClose={() => setShowCouponModal(false)}
                    onApply={handleApplyCoupon}
                    loading={actionLoading === 'add_coupon'}
                />
            )}

            <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"><ArrowLeft size={16} className="mr-2" />Volver al listado de clientes</button>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center">
                    <img src={client.avatarUrl} alt={client.nombre} className="h-16 w-16 rounded-full object-cover mr-4" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{client.nombre}</h1>
                        <p className="text-gray-500">{client.email}</p>
                        {isBlocked && <span className="inline-flex items-center mt-1 text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full"><ShieldOff size={10} className="mr-1" />BLOQUEADO</span>}
                    </div>
                </div>
                <div className="flex-shrink-0"><ClientStatusBadge status={client.status} /></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-6 overflow-x-auto">{tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                <tab.icon size={16} className="mr-2" />{tab.label} {tab.id === 'claims' && client.hasSernacClaim && <span className="ml-2 w-3 h-3 bg-red-500 rounded-full"></span>}
                            </button>
                        ))}</nav>
                    </div>
                    <div>{loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-primary" size={32} /></div> : renderTabContent()}</div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-4">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Acciones Rápidas</h3>
                            <div className="space-y-2">
                                {actions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleAction(action.id)}
                                        disabled={actionLoading !== null}
                                        className={`w-full flex items-center text-left py-2 px-3 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action.color}`}
                                    >
                                        {actionLoading === action.id
                                            ? <Loader2 size={16} className="mr-3 animate-spin" />
                                            : <action.icon size={16} className="mr-3" />
                                        }
                                        <span className="text-sm font-medium">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientProfile;