import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { Search, Filter, Calendar, CheckCircle, Clock, AlertTriangle, XCircle, Loader, MoreVertical, Trash2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface Promotion {
    id: string;
    service_id: string;
    service_name: string;
    provider_name: string;
    tier_name?: string;
    duration_days?: number;
    start_date: string;
    end_date: string;
    payment_status: 'PAID' | 'PENDING_DEDUCTION' | 'PENDING' | 'EXPIRED' | 'FAILED';
    amount: number;
    target_keywords: string[];
    created_at: string;
}

const AdminPromotions: React.FC = () => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchPromotions = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/promotions');
            if (response.data.status === 'success') {
                setPromotions(response.data.promotions);
            }
        } catch (error) {
            console.error("Error fetching promotions:", error);
        } finally {
            setLoading(false);
        }
    };


    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta promoción? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/admin/promotions/${id}`);
            fetchPromotions();
        } catch (error) {
            toast.error('Error al eliminar la promoción');
        }
    };

    const handleMarkPaid = async (id: string) => {
        if (!window.confirm('¿Confirmas que recibiste el pago para esta promoción?')) return;
        try {
            await api.put(`/admin/promotions/${id}`, { payment_status: 'PAID' });
            fetchPromotions();
        } catch (error) {
            toast.error('Error al actualizar el estado');
        }
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const filteredPromotions = promotions.filter(promo => {
        if (filterStatus !== 'all' && promo.payment_status !== filterStatus) return false;
        // Date filtering could be added here if needed
        return true;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"><CheckCircle size={12} className="mr-1" /> Pagado</span>;
            case 'PENDING_DEDUCTION':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800"><Clock size={12} className="mr-1" /> Pendiente Deducción</span>;
            case 'PENDING':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800"><Clock size={12} className="mr-1" /> Pendiente Pago</span>;
            case 'EXPIRED':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800"><XCircle size={12} className="mr-1" /> Expirado</span>;
            default:
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800"><AlertTriangle size={12} className="mr-1" /> {status}</span>;
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Auditoría de Promociones</h1>
                <div className="flex gap-2">
                    <button onClick={fetchPromotions} className="p-2 text-gray-500 hover:text-brand-primary transition-colors">
                        <Calendar size={20} />
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Filter size={20} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Estado:</span>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-brand-primary"
                    >
                        <option value="all">Todos</option>
                        <option value="PENDING_DEDUCTION">Pendiente Deducción</option>
                        <option value="PAID">Pagado</option>
                        <option value="PENDING">Pendiente Pago</option>
                        <option value="EXPIRED">Expirado</option>
                    </select>
                </div>
                {/* Date range pickers could go here */}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Servicio</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechas</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado de Pago</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>

                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keywords</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredPromotions.map((promo) => (
                                <tr key={promo.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{promo.service_name}</div>
                                        {promo.tier_name && <div className="text-xs text-gray-500">Plan: {promo.tier_name}{promo.duration_days ? ` (${promo.duration_days} dias)` : ''}</div>}
                                        <div className="text-xs text-gray-500">ID: {promo.service_id.substring(0, 8)}...</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{promo.provider_name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-500">
                                            {promo.payment_status === 'PAID' ? (
                                                <>
                                                    <div>Inicio: {new Date(promo.start_date).toLocaleDateString()}</div>
                                                    <div>Fin: {new Date(promo.end_date).toLocaleDateString()}</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div>No activa todavia</div>
                                                    <div>Se inicia al confirmar pago</div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(promo.payment_status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">${Number(promo.amount).toLocaleString('es-CL')}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {promo.target_keywords?.map((k, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200">
                                                    {k}
                                                </span>
                                            ))}
                                            {(!promo.target_keywords || promo.target_keywords.length === 0) && <span className="text-xs text-gray-400">-</span>}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            {promo.payment_status !== 'PAID' && (
                                                <button
                                                    onClick={() => handleMarkPaid(promo.id)}
                                                    className="text-green-600 hover:text-green-900 p-1 bg-green-50 rounded"
                                                    title="Marcar como Pagado"
                                                >
                                                    <DollarSign size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(promo.id)}
                                                className="text-red-600 hover:text-red-900 p-1 bg-red-50 rounded"
                                                title="Eliminar Promoción"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div >
        </div >
    );
};

export default AdminPromotions;
