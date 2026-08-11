import React, { useState, useMemo } from 'react';
import { OrderListItem, ProviderOrderStatus } from '../../../types';
import { Search, Calendar as CalendarIcon, Package, SlidersHorizontal, MoreVertical, CheckCircle } from 'lucide-react';

import { api } from '../../../api/client';
import toast from 'react-hot-toast';
// MOCK DATA REMOVED
const mockOrdersAndBookings: OrderListItem[] = [];
// --- END MOCK DATA ---

type ActiveTab = 'all' | 'services' | 'products';

const StatusBadge: React.FC<{ status: ProviderOrderStatus }> = ({ status }) => {
    const styles = {
        [ProviderOrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-800',
        [ProviderOrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
        [ProviderOrderStatus.COMPLETED]: 'bg-green-100 text-green-800',
        [ProviderOrderStatus.CANCELLED]: 'bg-red-100 text-red-800',
        [ProviderOrderStatus.IN_PROGRESS]: 'bg-indigo-100 text-indigo-800',
        [ProviderOrderStatus.DISPUTE]: 'bg-orange-100 text-orange-800 font-bold',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{status}</span>;
};

const ProviderOrders: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('all');
    const [orders, setOrders] = useState<OrderListItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState({
        search: '',
        status: '',
        dateFrom: '',
        dateTo: '',
    });

    React.useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/bookings');
                if (response.data.status === 'success') {
                    setOrders(response.data.bookings);
                }
            } catch (error) {
                toast.error("Error fetching orders");
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const filteredData = useMemo(() => {
        return orders.filter(item => {
            const matchesTab = activeTab === 'all' || item.type === (activeTab === 'services' ? 'service' : 'product');
            const searchLower = filters.search.toLowerCase();
            const matchesSearch = item.item_name.toLowerCase().includes(searchLower) || item.customer_name.toLowerCase().includes(searchLower);
            const matchesStatus = filters.status === '' || item.status === filters.status;
            // Date filtering logic would go here
            return matchesTab && matchesSearch && matchesStatus;
        });
    }, [activeTab, filters]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        if (!window.confirm('¿Confirmas que has finalizado este servicio? El cliente será notificado.')) return;

        try {
            setLoading(true);
            const response = await api.put(`/bookings/${orderId}/status`, { status: newStatus });
            if (response.data.status === 'success') {
                toast.success(response.data.message || 'Estado actualizado con éxito');
                // Refresh list by re-fetching all orders
                const updatedResponse = await api.get('/bookings');
                if (updatedResponse.data.status === 'success') {
                    setOrders(updatedResponse.data.bookings);
                }
            } else {
                toast.error(response.data.message || 'Error al actualizar estado');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Órdenes y Reservas</h1>
                <p className="mt-1 text-gray-600">Visualiza y gestiona todas las órdenes de tus productos y las reservas de tus servicios.</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative lg:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por item o cliente..."
                            value={filters.search}
                            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                        />
                    </div>
                    <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
                        <option value="">Todos los Estados</option>
                        {Object.values(ProviderOrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="date" value={filters.dateFrom} onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50" />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 px-4">
                        <button onClick={() => setActiveTab('all')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'all' ? 'border-brand-secondary text-brand-secondary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Todas</button>
                        <button onClick={() => setActiveTab('services')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'services' ? 'border-brand-secondary text-brand-secondary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Servicios</button>
                        <button onClick={() => setActiveTab('products')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'products' ? 'border-brand-secondary text-brand-secondary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Productos</button>
                    </nav>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="relative px-6 py-3"><span className="sr-only"></span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map(item => (
                                <tr key={item.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="mr-3 text-gray-400">{item.type === 'service' ? <CalendarIcon size={20} /> : <Package size={20} />}</div>
                                            <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.customer_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(item.amount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {(item.raw_status === 'in_escrow' || item.status === ProviderOrderStatus.CONFIRMED) && item.type === 'service' && (
                                            <button
                                                onClick={() => handleUpdateStatus(item.id, 'service_completed')}
                                                className="text-green-600 hover:text-green-800 mr-2 p-1 hover:bg-green-50 rounded-full transition-colors"
                                                title="Marcar como Finalizado"
                                            >
                                                <CheckCircle size={20} />
                                            </button>
                                        )}
                                        <button className="text-gray-500 hover:text-gray-800"><MoreVertical size={20} /></button>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-gray-500">
                                        {loading ? 'Cargando órdenes...' : 'No se encontraron órdenes o reservas.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProviderOrders;
