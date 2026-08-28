
import React, { useState, useMemo } from 'react';
import { Service, ServiceChangeReviewSummary } from '../../../types';
import { Edit, Trash2, Search, Tag } from 'lucide-react';
import ToggleSwitch from '../../admin/provider-management/ToggleSwitch';

interface ServiceListProps {
    services: Service[];
    onEdit: (service: Service) => void;
    onDelete: (serviceId: string) => void;
    onToggleStatus: (serviceId: string, isActive: boolean) => void;
    onPromote: (service: Service) => void;
    statusUpdatingIds?: Set<string>;
}

const ServiceList: React.FC<ServiceListProps> = ({ services, onEdit, onDelete, onToggleStatus, onPromote, statusUpdatingIds = new Set() }) => {
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

    const fieldLabels: Record<string, string> = {
        title: 'Nombre',
        description: 'Descripción',
        price: 'Precio',
        video_url: 'Video',
        cover_image_url: 'Portada',
        image_urls: 'Imágenes',
        gallery_media: 'Galería',
        category: 'Categoría',
        categories_json: 'Categorías',
        duration_minutes: 'Duración',
        type: 'Modalidad',
        pricing_type: 'Tipo de precio',
        availability_type: 'Disponibilidad',
        calendar_config: 'Agenda',
        features: 'Características',
        freight_base_price: 'Valor base',
        freight_price_per_km: 'Valor por km',
    };

    const reviewSubject = (review: ServiceChangeReviewSummary) => {
        if (review.scope === 'full') return 'Servicio completo';
        const labels = review.changedFields.map(field => fieldLabels[field] || field.replaceAll('_', ' '));
        if (labels.length === 0) return 'Cambios del Servicio';
        if (labels.length <= 2) return labels.join(' y ');
        return `${labels[0]} y ${labels.length - 1} cambios más`;
    };

    const getStatusBadge = (status: Service['status']) => {
        const styles = {
            'active': 'bg-green-100 text-green-800',
            'paused': 'bg-yellow-100 text-yellow-800',
            'draft': 'bg-gray-100 text-gray-800',
            'flagged': 'bg-red-100 text-red-800',
        };
        const labels: Record<Service['status'], string> = {
            active: 'Activo',
            paused: 'Pausado',
            draft: 'Borrador',
            flagged: 'Rechazado',
        };
        return <span aria-label={`Estado de publicación: ${labels[status]}`} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{labels[status]}</span>;
    };

    const getChangeStatus = (service: Service) => {
        const review = service.review;
        if (review) {
            const subject = reviewSubject(review);
            const reason = review.reason || review.reasons?.[0];

            if (review.status === 'changes_requested') {
                return (
                    <div className="max-w-xs">
                        <span className="inline-flex rounded-full bg-amber-100 px-2 text-xs font-semibold leading-5 text-amber-900">
                            Corrección solicitada · {subject}
                        </span>
                        {reason && <p className="mt-1 whitespace-normal text-xs text-gray-600">Motivo: {reason}</p>}
                    </div>
                );
            }

            if (review.status === 'rejected') {
                return (
                    <div className="max-w-xs">
                        <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">
                            Cambios rechazados · {subject}
                        </span>
                        {reason && <p className="mt-1 whitespace-normal text-xs text-gray-600">Motivo: {reason}</p>}
                    </div>
                );
            }

            return (
                <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">
                    En revisión · {subject}
                </span>
            );
        }

        // Compatibility for services returned by the previous API.
        if (service.moderation_status === 'pending') {
            return <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">Revisión inicial pendiente</span>;
        }
        if (service.moderation_status === 'rejected') {
            return (
                <div className="max-w-xs">
                    <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">Revisión rechazada</span>
                    {service.moderation_reason && <p className="mt-1 whitespace-normal text-xs text-gray-600">Motivo: {service.moderation_reason}</p>}
                </div>
            );
        }
        return <span className="text-xs font-medium text-gray-600">Sin cambios pendientes</span>;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        aria-label="Buscar Servicios por nombre"
                        placeholder="Buscar por nombre..."
                        value={filters.search}
                        onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <select aria-label="Filtrar por estado de publicación" value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
                        <option value="">Todos los Estados</option>
                        <option value="active">Activo</option>
                        <option value="paused">Pausado</option>
                        <option value="draft">Borrador</option>
                        <option value="flagged">Rechazado</option>
                    </select>
                    <select aria-label="Filtrar por modalidad" value={filters.type} onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Publicación</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cambios</th>
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
                                <td className="px-6 py-4">{getChangeStatus(service)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-4">
                                        <ToggleSwitch
                                            enabled={service.status === 'active'}
                                            disabled={service.moderation_status !== 'approved' || statusUpdatingIds.has(service.id)}
                                            label={`${service.status === 'active' ? 'Pausar' : 'Activar'} ${service.name}`}
                                            title={service.status === 'draft'
                                                ? 'El Servicio nuevo debe aprobarse antes de activarlo'
                                                : service.status === 'flagged'
                                                    ? 'El Servicio fue rechazado y debe corregirse antes de activarlo'
                                                    : statusUpdatingIds.has(service.id)
                                                        ? 'Actualizando estado...'
                                                        : service.status === 'active' ? 'Pausar Servicio' : 'Activar Servicio'}
                                            onChange={(isActive) => onToggleStatus(service.id, isActive)}
                                        />
                                        <button aria-label={`Editar ${service.name}`} title="Editar Servicio" onClick={() => onEdit(service)} className="rounded text-gray-600 hover:text-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary"><Edit size={18} aria-hidden="true" /></button>
                                        <button
                                            onClick={() => onPromote(service)}
                                            aria-label={`Promocionar ${service.name}`}
                                            className="rounded text-gray-600 hover:text-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            title="Promocionar Servicio"
                                        >
                                            <Tag size={18} aria-hidden="true" />
                                        </button>
                                        <button aria-label={`Eliminar ${service.name}`} title="Eliminar Servicio" onClick={() => onDelete(service.id)} className="rounded text-gray-600 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"><Trash2 size={18} aria-hidden="true" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredServices.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-10 text-gray-500">
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
