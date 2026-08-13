import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { Service } from '../../../types';
import { Search, Star, Filter, Loader, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminServices: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'staff_pick'>('all');

    const fetchServices = async () => {
        setLoading(true);
        try {
            // Fetch all services using dedicated admin endpoint
            const response = await api.get('/admin/services');
            if (response.data.status === 'success') {
                setServices(response.data.services || []);
            }
        } catch (error) {
            console.error("Error fetching services:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const toggleStaffPick = async (serviceId: string, currentStatus: boolean) => {
        try {
            const response = await api.patch(`/admin/services/${serviceId}/staff-pick`);
            if (response.data.status === 'success') {
                // Update local state
                setServices(services.map(s =>
                    s.id === serviceId ? { ...s, is_staff_pick: !currentStatus } : s
                ));
            }
        } catch (error) {
            toast.error("Error al actualizar estado de Staff Pick");
        }
    };


    const moderateService = async (serviceId: string, status: 'approved' | 'rejected') => {
        const reason = status === 'rejected'
            ? window.prompt('Motivo del rechazo (obligatorio):')?.trim()
            : '';
        if (status === 'rejected' && !reason) return;

        try {
            const response = await api.patch(`/admin/services/${serviceId}/moderation`, { status, reason });
            if (response.data.status === 'success') {
                const updated = response.data.service;
                setServices(current => current.map(service => (
                    service.id === serviceId
                        ? {
                            ...service,
                            moderation_status: updated.moderation_status,
                            moderation_reason: updated.moderation_reason,
                            status: updated.is_active ? 'active' : (updated.moderation_status === 'rejected' ? 'flagged' : 'draft')
                        }
                        : service
                )));
                toast.success(response.data.message);
            }
        } catch (error) {
            toast.error('No se pudo actualizar la moderacion del servicio.');
        }
    };
    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            service.provider?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'pending' && service.moderation_status === 'pending') ||
            (filter === 'staff_pick' && service.is_staff_pick);
        return matchesSearch && matchesFilter;
    });

    if (loading) return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Gestión de Servicios</h1>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o proveedor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={20} className="text-gray-500" />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-primary"
                    >
                        <option value="all">Todos</option>
                        <option value="staff_pick">Staff Picks</option>
                        <option value="pending">Pendientes de revisi?n</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Pick</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moderaci?n</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredServices.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                    No se encontraron servicios. (Verifica conexión API o filtros)
                                </td>
                            </tr>
                        )}
                        {filteredServices.map((service) => (
                            <tr key={service.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <img className="h-10 w-10 rounded-full object-cover" src={service.imageUrls?.[0] || 'https://via.placeholder.com/40'} alt="" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{service.name}</div>
                                            <div className="text-sm text-gray-500">{service.category}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{service.provider?.name || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">${service.price_clp.toLocaleString('es-CL')}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => toggleStaffPick(service.id, service.is_staff_pick || false)}
                                        className={`p-2 rounded-full transition-colors ${service.is_staff_pick ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        <Star size={20} fill={service.is_staff_pick ? "currentColor" : "none"} />
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                            service.moderation_status === 'approved'
                                                ? 'bg-green-100 text-green-800'
                                                : service.moderation_status === 'rejected'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {service.moderation_status === 'approved'
                                                ? 'Aprobado'
                                                : service.moderation_status === 'rejected'
                                                    ? 'Rechazado'
                                                    : 'Pendiente'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => moderateService(service.id, 'approved')}
                                            className="rounded p-1 text-green-700 hover:bg-green-50"
                                            title="Aprobar y publicar"
                                        >
                                            <CheckCircle size={19} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moderateService(service.id, 'rejected')}
                                            className="rounded p-1 text-red-700 hover:bg-red-50"
                                            title="Rechazar"
                                        >
                                            <XCircle size={19} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminServices;
