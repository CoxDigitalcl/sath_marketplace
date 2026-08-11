
import React, { useState, useMemo } from 'react';
import { Service } from '../../../types';
import { Edit, Trash2, MoreVertical, Filter, Search, Tag } from 'lucide-react';
import ToggleSwitch from '../../admin/provider-management/ToggleSwitch';

interface ServiceListProps {
    services: Service[];
    onEdit: (service: Service) => void;
    onDelete: (serviceId: string) => void;
    onToggleStatus: (serviceId: string, currentStatus: Service['status']) => void;
    onPromote: (service: Service) => void;
}

const ServiceList: React.FC<ServiceListProps> = ({ services, onEdit, onDelete, onToggleStatus, onPromote }) => {
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        type: '',
    });

    const filteredServices = useMemo(() => {
        return services.filter(service => {
            const matchesSearch = service.name.toLowerCase().includes(filters.search.toLowerCase());
            const matchesStatus = filters.status === '' || service.status === filters.status;
            const matchesType = filters.type === '' || service.type === filters.type;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [services, filters]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

    const getStatusBadge = (status: Service['status']) => {
        const styles = {
            'active': 'bg-green-100 text-green-800',
            'paused': 'bg-yellow-100 text-yellow-800',
            'draft': 'bg-gray-100 text-gray-800',
            'flagged': 'bg-red-100 text-red-800',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={filters.search}
                        onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
                        <option value="">Todos los Estados</option>
                        <option value="active">Activo</option>
                        <option value="paused">Pausado</option>
                        <option value="draft">Borrador</option>
                        <option value="flagged">Reportado</option>
                    </select>
                    <select value={filters.type} onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
                        <option value="">Todos los Tipos</option>
                        <option value="online">Online</option>
                        <option value="presencial">Presencial</option>
                        <option value="hibrido">Híbrido</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría(s)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredServices.map(service => (
                            <tr key={service.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{service.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {service.categories && service.categories.length > 0 ? (
                                        <div className="flex flex-col">
                                            <span className="flex items-center font-medium">
                                                <Tag size={12} className="mr-1 text-brand-secondary" />
                                                {service.categories[0].subcategory}
                                            </span>
                                            {service.categories.length > 1 && (
                                                <span className="text-xs text-gray-400 ml-4">
                                                    + {service.categories.length - 1} más
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic">Sin categoría</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatCurrency(service.price_clp)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.duration_minutes} min</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{service.type}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(service.status)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-4">
                                        <ToggleSwitch
                                            enabled={service.status === 'active'}
                                            onChange={() => onToggleStatus(service.id, service.status)}
                                        />
                                        <button onClick={() => onEdit(service)} className="text-gray-600 hover:text-brand-secondary"><Edit size={18} /></button>
                                        <button
                                            onClick={() => onPromote(service)}
                                            className="text-gray-600 hover:text-yellow-600"
                                            title="Promocionar Servicio"
                                        >
                                            <Tag size={18} />
                                        </button>
                                        <button onClick={() => onDelete(service.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredServices.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-gray-500">
                                    No se encontraron servicios.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ServiceList;
