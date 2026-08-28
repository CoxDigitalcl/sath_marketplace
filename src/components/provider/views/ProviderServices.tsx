
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Service, ServiceBooking, ServiceChangeReviewSummary, ServiceUpdateResponse } from '../../../types';
import ServiceList from '../services/ServiceList';
import ServiceForm from '../services/ServiceForm';
import ServiceCalendar from '../services/ServiceCalendar';
import PromotionModal from './PromotionModal';
import { List, Plus, Calendar, MapPin } from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';

// Services and Bookings data is fetched dynamically from the API

type ActiveTab = 'list' | 'form' | 'calendar';

interface ServicePublicationStatusResponse {
    status: 'success';
    message: string;
    service: {
        id: string;
        is_active: boolean;
        moderation_status: 'approved';
        updated_at: string;
    };
}

const serviceFieldLabels: Record<string, string> = {
    title: 'nombre',
    description: 'descripción',
    price: 'precio',
    video_url: 'video',
    cover_image_url: 'imagen de portada',
    image_urls: 'imágenes',
    gallery_media: 'galería',
    category: 'categoría',
    categories_json: 'categorías',
    duration_minutes: 'duración',
    type: 'modalidad',
    pricing_type: 'tipo de precio',
    availability_type: 'disponibilidad',
    calendar_config: 'agenda',
    features: 'características',
    freight_base_price: 'valor base del flete',
    freight_price_per_km: 'valor por kilómetro',
};

const normalizeFieldNames = (fields: unknown): string[] => (
    Array.isArray(fields)
        ? fields.filter((field): field is string => typeof field === 'string')
        : []
);

const normalizeReview = (source: any): ServiceChangeReviewSummary | null => {
    if (!source || typeof source !== 'object') return null;

    const rawStatus = source.status || source.review_status;
    const status = rawStatus === 'correction_requested' ? 'changes_requested' : rawStatus;
    if (!['pending', 'changes_requested', 'rejected'].includes(status)) return null;

    const reasons = normalizeFieldNames(source.reasons);
    return {
        revisionId: source.revisionId || source.revision_id || source.id,
        status,
        scope: source.scope === 'full' ? 'full' : 'targeted',
        changedFields: normalizeFieldNames(source.changedFields || source.changed_fields),
        reasons: reasons.length > 0 ? reasons : undefined,
        reason: typeof source.reason === 'string'
            ? source.reason
            : typeof source.correction_reason === 'string'
                ? source.correction_reason
                : undefined,
    };
};

const normalizeService = (service: any): Service => ({
    ...service,
    review: normalizeReview(
        service?.review
        || service?.change_review
        || service?.review_summary
        || service?.pending_review
    ),
});

const formatFieldList = (fields: string[]): string => {
    const labels = [...new Set(fields.map(field => serviceFieldLabels[field] || field.replaceAll('_', ' ')))];
    if (labels.length === 0) return 'los cambios';
    if (labels.length === 1) return labels[0];
    return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
};

const showUpdateFeedback = (response: ServiceUpdateResponse, service: Service) => {
    const appliedFields = normalizeFieldNames(response.appliedFields || (response as any).applied_fields);
    const review = normalizeReview(
        response.review
        || (response as any).change_review
        || (response as any).review_summary
        || (response as any).service?.review
    );
    const publicationMessage = service.status === 'active'
        ? 'La versión aprobada anterior continúa publicada.'
        : service.moderation_status === 'approved'
            ? 'La versión aprobada anterior se mantiene sin cambios.'
            : 'Lo pendiente no se publicará hasta que sea aprobado.';
    const appliedAction = service.status === 'active' ? 'publicados' : 'aplicados';

    switch (response.outcome) {
        case 'applied':
            toast.success(`Cambios ${appliedAction} sin revisión: ${formatFieldList(appliedFields)}.`);
            return;
        case 'review_required':
            toast.success(`Pendiente de revisión: ${formatFieldList(review?.changedFields || [])}. ${publicationMessage}`);
            return;
        case 'mixed':
            toast.success(`Cambios ${appliedAction} sin revisión: ${formatFieldList(appliedFields)}. Pendiente de revisión: ${formatFieldList(review?.changedFields || [])}. ${publicationMessage}`);
            return;
        case 'no_changes':
            toast('No había cambios nuevos para guardar.');
            return;
        default: {
            // Compatibility with the previous API response, which did not classify changes.
            const legacyModerationStatus = response.service?.moderation_status;
            if (legacyModerationStatus === 'pending') {
                toast.success('Servicio actualizado. El servidor indicó que quedó pendiente de revisión.');
            } else {
                toast.success('Servicio actualizado.');
            }
        }
    }
};

const ProviderServices: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('list');
    const [services, setServices] = useState<Service[]>([]);
    const [bookings, setBookings] = useState<ServiceBooking[]>([]); // Calendar data missing from this scope for now
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [loading, setLoading] = useState(true);
    const [coverageSummary, setCoverageSummary] = useState('');
    const [statusUpdatingIds, setStatusUpdatingIds] = useState<Set<string>>(new Set());

    // Promotion Modal State
    const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
    const [selectedServiceForPromotion, setSelectedServiceForPromotion] = useState<{ id: string, name: string } | null>(null);

    const fetchMyServices = async () => {
        setLoading(true);
        try {
            const response = await api.get('/services/my-services');
            if (response.data.status === 'success') {
                setServices(response.data.services.map(normalizeService));
            }
        } catch (error) {
            console.error("Error fetching services", error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchMyServices();
        api.get('/provider/profile')
            .then((response) => {
                const profile = response.data?.profile;
                if (!profile) return;
                const communes = Array.isArray(profile.coverage_communes) ? profile.coverage_communes : [];
                const summary = profile.coverage_area
                    || (profile.coverage_region_name && communes.length > 0
                        ? `${profile.coverage_region_name}: ${communes.join(', ')}`
                        : profile.coverage_region_name || '');
                setCoverageSummary(summary);
            })
            .catch(() => setCoverageSummary(''));
    }, []);

    const handleEdit = (service: Service) => {
        setEditingService(service);
        setActiveTab('form');
    };

    const handleAdd = () => {
        setEditingService(null);
        setActiveTab('form');
    };

    const handleSave = async (serviceToSave: Service) => {
        try {
            const payload: any = {
                title: serviceToSave.name,
                description: serviceToSave.description,
                price: serviceToSave.price_clp,
                category: serviceToSave.categories[0]?.categoryId || 'other',
                video_url: serviceToSave.videoUrl || '',
                cover_image_url: serviceToSave.coverImageUrl || '',
                // New Fields
                duration_minutes: serviceToSave.duration_minutes,
                type: serviceToSave.type,
                pricing_type: serviceToSave.pricing_type || 'per_event',
                availability_type: serviceToSave.availability_type,
                calendar_config: serviceToSave.calendar_config,
                features: serviceToSave.features,
                image_urls: serviceToSave.imageUrls,
                categories_json: serviceToSave.categories,
                gallery_media: serviceToSave.galleryMedia || []
            };

            // Forward freight-specific fields if present
            if ((serviceToSave as any).freight_base_price !== undefined) {
                payload.freight_base_price = (serviceToSave as any).freight_base_price;
            }
            if ((serviceToSave as any).freight_price_per_km !== undefined) {
                payload.freight_price_per_km = (serviceToSave as any).freight_price_per_km;
            }

            if (serviceToSave.id) {
                // UPDATE
                const updateRes = await api.put<ServiceUpdateResponse>(`/services/${serviceToSave.id}`, {
                    ...payload,
                    expected_revision_id: serviceToSave.review?.status === 'rejected'
                        ? null
                        : serviceToSave.review?.revisionId ?? null,
                });
                showUpdateFeedback(updateRes.data, serviceToSave);
            } else {
                // CREATE
                const createRes = await api.post('/services', payload);
                const newServiceId = createRes.data?.service?.id;

                // If freight service with temp vehicles, persist them now
                const pendingVehicles = (serviceToSave as any)._tempFreightVehicles;
                if (newServiceId && pendingVehicles && pendingVehicles.length > 0) {
                    for (const v of pendingVehicles) {
                        try {
                            await api.post(`/freight/services/${newServiceId}/vehicles`, {
                                name: v.name,
                                height_cm: v.height_cm,
                                width_cm: v.width_cm,
                                depth_cm: v.depth_cm,
                                max_weight_kg: v.max_weight_kg,
                            });
                        } catch (vErr) {
                            console.error('Error saving temp vehicle:', vErr);
                        }
                    }
                }

                toast.success('Servicio creado. Quedó pendiente de revisión antes de publicarse.');
                // Only redirect on Create
                setActiveTab('list');
                setEditingService(null);
            }

            // Refresh list (background)
            fetchMyServices();

        } catch (err: any) {
            console.error("Error saving service", err);
            const msg = err.response?.data?.message || err.message || "Error al guardar";
            toast.error(`No se pudo guardar el servicio. ${msg}`);
        }
    };

    const handleCancel = () => {
        setActiveTab('list');
        setEditingService(null);
    };

    const handleDelete = (serviceId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este servicio? Esta acción no se puede deshacer.")) {
            setServices(services.filter(s => s.id !== serviceId));
        }
    };

    const handleToggleStatus = async (serviceId: string, isActive: boolean) => {
        setStatusUpdatingIds(current => new Set(current).add(serviceId));
        try {
            const response = await api.patch<ServicePublicationStatusResponse>(`/services/${serviceId}/status`, { is_active: isActive });
            const updated = response.data?.service;
            if (!updated) throw new Error('El servidor no devolvio el servicio actualizado.');

            setServices(current => current.map(service => (
                service.id === serviceId
                    ? {
                        ...service,
                        status: updated.is_active ? 'active' : 'paused',
                        moderation_status: updated.moderation_status,
                    }
                    : service
            )));
            toast.success(response.data?.message || (isActive ? 'Servicio activado.' : 'Servicio pausado.'));
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'No se pudo actualizar el estado del servicio.';
            toast.error(message);
        } finally {
            setStatusUpdatingIds(current => {
                const next = new Set(current);
                next.delete(serviceId);
                return next;
            });
        }
    };

    // Promotion handlers
    const handlePromote = (service: Service) => {
        setSelectedServiceForPromotion({ id: service.id, name: service.name });
        setIsPromotionModalOpen(true);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'list': return <ServiceList services={services} onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggleStatus} onPromote={handlePromote} statusUpdatingIds={statusUpdatingIds} />;
            case 'form': return <ServiceForm service={editingService} onSave={handleSave} onCancel={handleCancel} />;
            case 'calendar': return <ServiceCalendar bookings={bookings} />;
            default: return null;
        }
    };

    const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
        { id: 'list', label: 'Lista', icon: List },
        { id: 'calendar', label: 'Agenda', icon: Calendar },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Servicios</h1>
                <p className="mt-1 text-gray-600">Crea, edita y gestiona tus servicios y agenda de reservas.</p>
            </div>

            <div className={`rounded-lg border p-4 ${coverageSummary ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                    <MapPin className={`mt-0.5 h-5 w-5 flex-shrink-0 ${coverageSummary ? 'text-green-600' : 'text-amber-600'}`} />
                    <div>
                        <h2 className={`text-sm font-bold ${coverageSummary ? 'text-green-900' : 'text-amber-900'}`}>
                            Cobertura de tus servicios
                        </h2>
                        {coverageSummary ? (
                            <p className="mt-1 text-sm text-green-800">
                                Todos tus servicios presenciales heredan esta cobertura desde Perfil y KYC: <span className="font-semibold">{coverageSummary}</span>
                            </p>
                        ) : (
                            <p className="mt-1 text-sm text-amber-800">
                                Aun no tienes region y comunas configuradas. Ve a Perfil y KYC para definir donde atiendes antes de publicar servicios presenciales.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {activeTab !== 'form' && (
                <button onClick={handleAdd} className="flex items-center justify-center gap-2 bg-brand-secondary hover:bg-brand-primary text-white font-semibold py-2 px-4 rounded-md transition-colors duration-300">
                    <Plus size={18} />
                    <span>Nuevo Servicio</span>
                </button>
            )}

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-brand-secondary text-brand-secondary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <tab.icon size={16} className="mr-2" />
                            {tab.label}
                        </button>
                    ))}
                    {editingService && activeTab === 'form' && (
                        <div className="whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm border-brand-secondary text-brand-secondary">
                            <Plus size={16} className="mr-2" />
                            Editar Servicio
                        </div>
                    )}
                </nav>
            </div>

            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {renderContent()}
            </motion.div>

            {/* Promotion Modal */}
            {selectedServiceForPromotion && (
                <PromotionModal
                    isOpen={isPromotionModalOpen}
                    onClose={() => { setIsPromotionModalOpen(false); setSelectedServiceForPromotion(null); }}
                    serviceId={selectedServiceForPromotion.id}
                    serviceName={selectedServiceForPromotion.name}
                    onSuccess={(message) => {
                        fetchMyServices();
                        toast.success(message || 'Solicitud de promoción registrada. Se publicará cuando el pago quede confirmado.');
                    }}
                />
            )}
        </div>
    );
};

export default ProviderServices;
