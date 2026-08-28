import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Filter, Image as ImageIcon, Loader, RefreshCw, Search, ShieldAlert, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../api/client';
import { Service } from '../../../types';
import ServiceRevisionReviewModal, {
    normalizeServiceRevisionSummary,
    ServiceRevisionSummary
} from '../services/ServiceRevisionReviewModal';

interface AdminService extends Service {
    category?: string;
    is_staff_pick?: boolean;
    provider?: { name?: string; email?: string; phone?: string };
}

type ServiceFilter = 'all' | 'pending' | 'staff_pick';

const FIELD_LABELS: Record<string, string> = {
    title: 'nombre', name: 'nombre', description: 'descripción', price: 'precio', price_clp: 'precio',
    duration_minutes: 'duración', type: 'modalidad', availability_type: 'disponibilidad',
    category: 'categoría', categories: 'categorías', categories_json: 'categorías',
    video_url: 'video', videoUrl: 'video', cover_image_url: 'portada', coverImageUrl: 'portada',
    image_urls: 'imágenes', imageUrls: 'imágenes', gallery_media: 'galería', galleryMedia: 'galería',
    coverage_area: 'cobertura', coverage_communes: 'cobertura'
};

const fieldLabel = (field: string) => FIELD_LABELS[field]
    || field.replace(/_/g, ' ').replace(/^./, letter => letter.toLowerCase());

const getResponseItems = (data: unknown): unknown[] => {
    if (!data || typeof data !== 'object') return [];
    const payload = data as Record<string, unknown>;
    const nested = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? payload.data as Record<string, unknown>
        : {};
    const candidates = [payload.revisions, payload.items, payload.data, nested.revisions, nested.items];
    return candidates.find(Array.isArray) as unknown[] || [];
};

const getApiMessage = (error: unknown, fallback: string) => {
    if (!error || typeof error !== 'object') return fallback;
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
};

const getHttpStatus = (error: unknown) => (
    error && typeof error === 'object'
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
);

const revisionSummaryText = (revision: ServiceRevisionSummary) => {
    if (revision.scope === 'full') return 'Revisión completa requerida';
    const labels = revision.changedFields.map(fieldLabel);
    if (labels.length === 0) return 'Cambios pendientes';
    if (labels.length === 1) return `Cambio en ${labels[0]}`;
    const visible = labels.slice(0, 2).join(' y ');
    return labels.length > 2 ? `${labels.length} cambios: ${visible} y más` : `${labels.length} cambios: ${visible}`;
};

const ServiceThumbnail: React.FC<{ service: AdminService }> = ({ service }) => {
    const source = service.coverImageUrl || service.imageUrls?.[0];
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [source]);

    if (!source || failed) {
        return (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400" title="Servicio sin imagen" aria-label="Servicio sin imagen">
                <ImageIcon size={18} aria-hidden="true" />
            </div>
        );
    }

    return <img className="h-10 w-10 rounded-lg bg-gray-100 object-cover" src={source} alt={`Imagen de ${service.name}`} onError={() => setFailed(true)} />;
};

const AdminServices: React.FC = () => {
    const [services, setServices] = useState<AdminService[]>([]);
    const [pendingRevisions, setPendingRevisions] = useState<ServiceRevisionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [servicesError, setServicesError] = useState('');
    const [revisionQueueError, setRevisionQueueError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<ServiceFilter>('all');
    const [reviewing, setReviewing] = useState<{ revisionId: string; service: AdminService } | null>(null);

    const fetchRevisionQueue = useCallback(async () => {
        try {
            const revisions: ServiceRevisionSummary[] = [];
            let page = 1;
            let totalPages = 1;
            do {
                const response = await api.get('/admin/service-revisions', { params: { status: 'pending', page, pageSize: 200 } });
                revisions.push(...getResponseItems(response.data)
                    .map(normalizeServiceRevisionSummary)
                    .filter((revision): revision is ServiceRevisionSummary => Boolean(revision)));
                const reportedTotalPages = Number((response.data as { pagination?: { totalPages?: number } })?.pagination?.totalPages || 1);
                totalPages = Number.isInteger(reportedTotalPages) && reportedTotalPages >= page
                    ? reportedTotalPages
                    : page;
                page += 1;
            } while (page <= totalPages);
            setPendingRevisions(revisions);
            setRevisionQueueError('');
        } catch (error) {
            setPendingRevisions([]);
            const status = getHttpStatus(error);
            setRevisionQueueError(status === 404 || status === 501
                ? 'El detalle diferencial todavía no está disponible. Los Servicios siguen visibles, pero las decisiones quedan deshabilitadas.'
                : getApiMessage(error, 'No se pudo cargar la cola de revisiones. Las decisiones quedan deshabilitadas para evitar moderar a ciegas.'));
        }
    }, []);

    const fetchServices = useCallback(async (showInitialLoader = true) => {
        if (showInitialLoader) setLoading(true);
        else setRefreshing(true);
        setServicesError('');
        try {
            const [servicesResult] = await Promise.allSettled([api.get('/admin/services'), fetchRevisionQueue()]);
            if (servicesResult.status === 'rejected') throw servicesResult.reason;
            if (servicesResult.value.data.status === 'success') setServices(servicesResult.value.data.services || []);
            else {
                setServices([]);
                setServicesError('La API no pudo entregar el listado de Servicios.');
            }
        } catch (error) {
            setServicesError(getApiMessage(error, 'No se pudo cargar el listado de Servicios.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fetchRevisionQueue]);

    useEffect(() => { void fetchServices(); }, [fetchServices]);

    const revisionByServiceId = useMemo(() => {
        const result = new Map<string, ServiceRevisionSummary>();
        pendingRevisions.forEach(revision => {
            const current = result.get(revision.serviceId);
            if (!current || String(revision.createdAt || '') > String(current.createdAt || '')) result.set(revision.serviceId, revision);
        });
        return result;
    }, [pendingRevisions]);

    const toggleStaffPick = async (serviceId: string, currentStatus: boolean) => {
        try {
            const response = await api.patch(`/admin/services/${serviceId}/staff-pick`);
            if (response.data.status === 'success') {
                setServices(current => current.map(service => service.id === serviceId ? { ...service, is_staff_pick: !currentStatus } : service));
            }
        } catch {
            toast.error('Error al actualizar el estado de Staff Pick.');
        }
    };

    const filteredServices = services.filter(service => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es-CL');
        const matchesSearch = service.name.toLocaleLowerCase('es-CL').includes(normalizedSearch)
            || Boolean(service.provider?.name?.toLocaleLowerCase('es-CL').includes(normalizedSearch));
        const hasPendingReview = revisionByServiceId.has(service.id) || service.moderation_status === 'pending';
        const matchesFilter = filter === 'all' || (filter === 'pending' && hasPendingReview) || (filter === 'staff_pick' && service.is_staff_pick);
        return matchesSearch && matchesFilter;
    });

    const handleDecisionCompleted = async () => {
        setReviewing(null);
        await fetchServices(false);
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center" role="status">
                <Loader className="animate-spin text-brand-primary" aria-hidden="true" />
                <span className="sr-only">Cargando Servicios</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gestión de Servicios</h1>
                    <p className="mt-1 text-sm text-gray-600">Revisa únicamente los cambios que requieren una decisión administrativa.</p>
                </div>
                <button type="button" onClick={() => void fetchServices(false)} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
                    <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                    {refreshing ? 'Actualizando…' : 'Actualizar'}
                </button>
            </div>

            {servicesError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                    <AlertCircle className="mt-0.5 flex-none" size={20} aria-hidden="true" />
                    <div><p className="font-semibold">No pudimos cargar los Servicios</p><p className="mt-1">{servicesError}</p></div>
                </div>
            )}
            {revisionQueueError && !servicesError && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
                    <ShieldAlert className="mt-0.5 flex-none" size={20} aria-hidden="true" />
                    <div><p className="font-semibold">Cola de revisión no disponible</p><p className="mt-1">{revisionQueueError}</p></div>
                </div>
            )}

            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row">
                <div className="relative flex-1">
                    <label htmlFor="admin-service-search" className="sr-only">Buscar por nombre o proveedor</label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} aria-hidden="true" />
                    <input id="admin-service-search" type="search" placeholder="Buscar por nombre o proveedor…" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={20} className="text-gray-500" aria-hidden="true" />
                    <label htmlFor="admin-service-filter" className="sr-only">Filtrar Servicios</label>
                    <select id="admin-service-filter" value={filter} onChange={event => setFilter(event.target.value as ServiceFilter)} className="min-h-11 flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary sm:flex-none">
                        <option value="all">Todos</option>
                        <option value="staff_pick">Staff Picks</option>
                        <option value="pending">Requieren revisión</option>
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-[920px] divide-y divide-gray-200">
                        <thead className="bg-gray-50"><tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Proveedor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Precio</th>
                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Staff Pick</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Moderación</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredServices.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">{servicesError ? 'Actualiza la página para volver a intentar.' : 'No se encontraron Servicios para esta búsqueda o filtro.'}</td></tr>}
                            {filteredServices.map(service => {
                                const revision = revisionByServiceId.get(service.id);
                                const category = service.category || service.categories?.map(item => item.subcategory).filter(Boolean).join(', ') || 'Sin categoría';
                                return (
                                    <tr key={service.id} className="align-middle hover:bg-gray-50/70">
                                        <td className="px-6 py-4"><div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0"><ServiceThumbnail service={service} /></div>
                                            <div className="ml-4 min-w-0"><div className="max-w-xs truncate text-sm font-medium text-gray-900" title={service.name}>{service.name}</div><div className="max-w-xs truncate text-sm text-gray-500" title={category}>{category}</div></div>
                                        </div></td>
                                        <td className="px-6 py-4"><div className="max-w-48 truncate text-sm text-gray-900" title={service.provider?.name || ''}>{service.provider?.name || 'Proveedor no informado'}</div></td>
                                        <td className="whitespace-nowrap px-6 py-4"><div className="text-sm tabular-nums text-gray-900">${Number(service.price_clp || 0).toLocaleString('es-CL')}</div></td>
                                        <td className="whitespace-nowrap px-6 py-4 text-center">
                                            <button type="button" onClick={() => void toggleStaffPick(service.id, service.is_staff_pick || false)} className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${service.is_staff_pick ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} aria-label={service.is_staff_pick ? `Quitar ${service.name} de Staff Pick` : `Marcar ${service.name} como Staff Pick`} aria-pressed={Boolean(service.is_staff_pick)}>
                                                <Star size={20} fill={service.is_staff_pick ? 'currentColor' : 'none'} aria-hidden="true" />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {revision ? (
                                                <div className="flex min-w-56 flex-col items-start gap-2">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"><ShieldAlert size={14} aria-hidden="true" />Requiere revisión</span>
                                                    <p className="text-xs text-gray-600">{revisionSummaryText(revision)}</p>
                                                    <button type="button" onClick={() => setReviewing({ revisionId: revision.id, service })} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-primary bg-white px-3 py-2 text-sm font-semibold text-brand-primary hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2">Revisar cambios</button>
                                                </div>
                                            ) : service.moderation_status === 'approved' ? (
                                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Aprobado</span>
                                            ) : service.moderation_status === 'rejected' ? (
                                                <div className="flex flex-col items-start gap-1"><span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">Rechazado</span>{service.moderation_reason && <p className="max-w-64 text-xs text-gray-600">{service.moderation_reason}</p>}</div>
                                            ) : service.moderation_status === 'pending' ? (
                                                <div className="flex flex-col items-start gap-1"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Pendiente</span><p className="max-w-64 text-xs text-gray-600">Sin detalle verificable; no se puede decidir desde esta tabla.</p></div>
                                            ) : (
                                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">Sin revisión pendiente</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <ServiceRevisionReviewModal
                open={Boolean(reviewing)}
                revisionId={reviewing?.revisionId || null}
                service={reviewing ? { id: reviewing.service.id, name: reviewing.service.name, providerName: reviewing.service.provider?.name } : undefined}
                onClose={() => setReviewing(null)}
                onDecided={handleDecisionCompleted}
            />
        </div>
    );
};

export default AdminServices;
