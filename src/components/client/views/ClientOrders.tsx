import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ShieldAlert, Package, AlertCircle, X, Calendar, MapPin, User, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../api/client';

interface BookingItem {
    id: string;
    type: 'service' | 'product';
    item_name: string;
    customer_name: string; // For clients, this is provider name
    date: string;
    amount: number;
    status: string;
    raw_status?: string;
    scheduled_date?: string;
    service_location?: string;
    invoice_url?: string;
    invoice_folio?: string;
    notes?: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const stylesMap: Record<string, string> = {
        'Pendiente': 'bg-yellow-100 text-yellow-800',
        'Pendiente de Pago': 'bg-yellow-100 text-yellow-800',
        'Confirmado': 'bg-blue-100 text-blue-800',
        'En Proceso': 'bg-indigo-100 text-indigo-800',
        'Entregado': 'bg-green-100 text-green-800',
        'Completado': 'bg-green-100 text-green-800',
        'Pagado': 'bg-emerald-100 text-emerald-800',
        'En Disputa': 'bg-orange-100 text-orange-800',
        'Cancelado': 'bg-red-100 text-red-800',
        'Reembolsado': 'bg-gray-100 text-gray-800',
    };
    const style = stylesMap[status] || 'bg-gray-100 text-gray-600';
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style}`}>{status}</span>;
};

// Order Detail Modal
const OrderDetailModal: React.FC<{
    order: BookingItem;
    onClose: () => void;
    onClaim: () => void;
}> = ({ order, onClose, onClaim }) => {
    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-CL', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-primary to-orange-500 text-white p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm opacity-80">Orden</p>
                            <h3 className="text-xl font-bold">#{order.id.slice(0, 8)}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-orange-100 p-3 rounded-lg">
                            <Package size={24} className="text-orange-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900">{order.item_name}</h4>
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                <User size={14} /> {order.customer_name}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar size={16} className="text-gray-400" />
                            <div>
                                <p className="text-gray-500">Fecha</p>
                                <p className="font-medium text-gray-800">{formatDate(order.date)}</p>
                            </div>
                        </div>
                        {order.scheduled_date && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar size={16} className="text-gray-400" />
                                <div>
                                    <p className="text-gray-500">Programado</p>
                                    <p className="font-medium text-gray-800">{formatDate(order.scheduled_date)}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                            <CreditCard size={16} className="text-gray-400" />
                            <div>
                                <p className="text-gray-500">Total</p>
                                <p className="font-bold text-lg text-gray-900">{formatCurrency(order.amount)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div>
                                <p className="text-gray-500">Estado</p>
                                <div className="mt-1"><StatusBadge status={order.status} /></div>
                            </div>
                        </div>
                        {order.invoice_url && (
                            <div className="col-span-2 flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
                                <div className="flex items-center gap-2">
                                    <Package size={16} className="text-blue-600" />
                                    <span className="text-sm font-medium text-blue-800">Boleta Electrónica Disponible</span>
                                </div>
                                <a
                                    href={order.invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition"
                                >
                                    Descargar PDF
                                </a>
                            </div>
                        )}
                    </div>

                    {order.service_location && (
                        <div className="flex items-start gap-2 text-sm pt-4 border-t">
                            <MapPin size={16} className="text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-gray-500">Ubicación</p>
                                <p className="font-medium text-gray-800">{order.service_location}</p>
                            </div>
                        </div>
                    )}

                    {order.notes && (
                        <div className="bg-gray-50 rounded-lg p-3 text-sm">
                            <p className="text-gray-500 mb-1">Notas:</p>
                            <p className="text-gray-700">{order.notes}</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-50 border-t flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={onClaim}
                        className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition flex items-center justify-center gap-2"
                    >
                        <ShieldAlert size={18} /> Abrir Reclamo
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const ClientOrders: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<BookingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<BookingItem | null>(null);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await api.get('/bookings');
            if (response.data.status === 'success') {
                setOrders(response.data.bookings || []);
            } else {
                setError(response.data.message || 'Error al cargar órdenes');
            }
        } catch (err: any) {
            console.error('Error fetching orders:', err);
            setError(err.response?.data?.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenClaim = (orderId: string) => {
        // Navigate to client dashboard with claims view and pre-selected booking
        navigate('/client/dashboard', {
            state: {
                view: 'claims',
                preselectedBookingId: orderId
            }
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Órdenes</h1>
                    <p className="mt-1 text-gray-600">Revisa el historial de todos tus servicios contratados y productos comprados.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                        <div className="h-4 w-48 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Órdenes</h1>
                    <p className="mt-1 text-gray-600">Revisa el historial de todos tus servicios contratados y productos comprados.</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Órdenes</h1>
                    <p className="mt-1 text-gray-600">Revisa el historial de todos tus servicios contratados y productos comprados.</p>
                </div>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes órdenes aún</h3>
                        <p className="text-gray-500">Cuando contrates un servicio, aparecerá aquí.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden #</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {orders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                                                #{order.id.slice(0, 8)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(order.date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {order.item_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {order.customer_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                                                {formatCurrency(order.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="text-gray-600 hover:text-brand-primary flex items-center gap-1"
                                                    >
                                                        <Eye size={16} /> Ver
                                                    </button>
                                                    {order.invoice_url && (
                                                        <a
                                                            href={order.invoice_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                            title="Ver Boleta"
                                                        >
                                                            <Package size={16} /> Boleta
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenClaim(order.id)}
                                                        className="text-red-600 hover:text-red-800 flex items-center gap-1"
                                                    >
                                                        <ShieldAlert size={16} /> Reclamar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Detail Modal */}
            <AnimatePresence>
                {selectedOrder && (
                    <OrderDetailModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onClaim={() => {
                            handleOpenClaim(selectedOrder.id);
                            setSelectedOrder(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default ClientOrders;