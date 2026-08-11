
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Service, ServiceBooking, DailySchedule } from '../../../types';
import ServiceList from '../services/ServiceList';
import ServiceForm from '../services/ServiceForm';
import ServiceCalendar from '../services/ServiceCalendar';
import PromotionModal from './PromotionModal';
import { List, Plus, Calendar, MapPin } from 'lucide-react';
import { api } from '../../../api/client';

// Services and Bookings data is fetched dynamically from the API

type ActiveTab = 'list' | 'form' | 'calendar';

const ProviderServices: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('list');
    const [services, setServices] = useState<Service[]>([]);
    const [bookings, setBookings] = useState<ServiceBooking[]>([]); // Calendar data missing from this scope for now
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [loading, setLoading] = useState(true);
    const [coverageSummary, setCoverageSummary] = useState('');

    // Promotion Modal State
    const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
    const [selectedServiceForPromotion, setSelectedServiceForPromotion] = useState<{ id: string, name: string } | null>(null);

    const fetchMyServices = async () => {
        setLoading(true);
        try {
            const response = await api.get('/services/my-services');
            if (response.data.status === 'success') {
                setServices(response.data.services);
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
                is_active: serviceToSave.status === 'active',
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
                await api.put(`/services/${serviceToSave.id}`, payload);
                alert("Servicio actualizado correctamente.");
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

                alert("Servicio creado correctamente.");
                // Only redirect on Create
                setActiveTab('list');
                setEditingService(null);
            }

            // Refresh list (background)
            fetchMyServices();

        } catch (err: any) {
            console.error("Error saving service", err);
            const msg = err.response?.data?.message || err.message || "Error al guardar";
            alert(`Error al guardar servicio: ${msg}`);
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

    const handleToggleStatus = (serviceId: string, currentStatus: Service['status']) => {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        setServices(services.map(s => s.id === serviceId ? { ...s, status: newStatus } : s));
    };

    // Promotion handlers
    const handlePromote = (service: Service) => {
        setSelectedServiceForPromotion({ id: service.id, name: service.name });
        setIsPromotionModalOpen(true);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'list': return <ServiceList services={services} onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggleStatus} onPromote={handlePromote} />;
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
                        alert(message || 'Solicitud de promocion registrada. Se publicara cuando el pago quede confirmado.');
                    }}
                />
            )}
        </div>
    );
};

export default ProviderServices;
