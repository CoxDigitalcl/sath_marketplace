
import React, { useState, useEffect, useCallback } from 'react';
import { Page } from '../../types';
import type { FreightVehicle, LogisticsPlan } from '../../types';
import type { GeoSearchResult } from '../../services/geo/types';
import { api } from '../../api/client';
import { MapPin, Clock, ShieldCheck, Check, Share2, Heart, Calendar as CalendarIcon, ArrowRight, PlayCircle, Lock, Play, ImageIcon, Truck } from 'lucide-react';
import { StarIcon } from '../IconComponents';
import VideoPlayer from '../common/VideoPlayer';
import MediaLightbox, { MediaItem } from '../common/MediaLightbox';
import FreightRouteMap from '../common/FreightRouteMap';
import FreightLogisticsCalculator from '../common/FreightLogisticsCalculator';
import toast from 'react-hot-toast';

interface ServiceDetailPageProps {
    navigateTo: (page: Page, params?: any) => void;
    serviceId?: string;
}

const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({ navigateTo, serviceId }) => {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [service, setService] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [availabilityMessage, setAvailabilityMessage] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [favLoading, setFavLoading] = useState(false);

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // === Freight booking state ===
    const [freightStep, setFreightStep] = useState<1 | 2 | 3>(1);
    const [freightVehicles, setFreightVehicles] = useState<FreightVehicle[]>([]);
    const [freightRouteData, setFreightRouteData] = useState<{
        origin: GeoSearchResult;
        destination: GeoSearchResult;
        distanceKm: number;
        durationMinutes: number;
    } | null>(null);
    const [freightPlan, setFreightPlan] = useState<LogisticsPlan | null>(null);

    // Fetch Service Details
    useEffect(() => {
        let isActive = true;

        setLoading(true);
        setService(null);
        setSelectedDate('');
        setSelectedTimes([]);
        setAvailableSlots([]);
        setAvailabilityMessage('');
        setFreightStep(1);
        setFreightVehicles([]);
        setFreightRouteData(null);
        setFreightPlan(null);
        setIsFavorite(false);
        setFavLoading(false);

        const fetchService = async () => {
            if (!serviceId) return;
            try {
                const res = await api.get(`/services/${serviceId}`);
                if (!isActive) return;
                if (res.data.status === 'success') {
                    const s = res.data.service;
                    const coverageCommunes = Array.isArray(s.coverage_communes)
                        ? s.coverage_communes
                        : (() => {
                            try {
                                const parsed = JSON.parse(s.coverage_communes || '[]');
                                return Array.isArray(parsed) ? parsed : [];
                            } catch {
                                return [];
                            }
                        })();
                    // Adapter: Map Backend to UI
                    const adaptedService = {
                        id: s.id,
                        title: s.title,
                        provider: {
                            id: s.provider_id,
                            name: s.provider_name || 'Proveedor Verificado',
                            avatar: s.provider_image || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
                            rating: 5.0,
                            reviews: 0,
                            verified: true,
                            responseTime: '1 hora'
                        },
                        description: s.description,
                        features: ['Garantía de satisfacción', 'Pago Seguro', 'Identidad Verificada'],
                        price: parseFloat(s.price),
                        duration: 'A convenir',
                        location: s.coverage_area || s.coverage_region_name || 'Cobertura por confirmar',
                        coverage_region_code: s.coverage_region_code || '',
                        coverage_region_name: s.coverage_region_name || '',
                        coverage_communes: coverageCommunes,
                        coverage_area: s.coverage_area || '',
                        type: s.type || 'presencial',
                        videoUrl: s.video_url,
                        coverImageUrl: s.cover_image_url || null,
                        galleryMedia: s.gallery_media || [],
                        images: s.image_urls?.length > 0
                            ? s.image_urls
                            : [],
                        pricing_type: s.pricing_type || 'per_event',
                        // Freight fields
                        freight_base_price: s.freight_base_price ? parseFloat(s.freight_base_price) : null,
                        freight_price_per_km: s.freight_price_per_km ? parseFloat(s.freight_price_per_km) : null,
                        categories_json: s.categories_json || [],
                        reviews: []
                    };
                    setService(adaptedService);

                    // If freight service, load vehicles
                    const cats = s.categories_json || [];
                    const isFreight = cats.some((c: any) => c.categoryId === 'fletes');
                    if (isFreight && s.id) {
                        try {
                            const vRes = await api.get(`/freight/services/${s.id}/vehicles`);
                            if (!isActive) return;
                            if (vRes.data.vehicles) setFreightVehicles(vRes.data.vehicles);
                        } catch (e) { /* silently fail */ }
                    }
                }
            } catch (error) {
                // Silently handle
            } finally {
                if (isActive) setLoading(false);
            }
        };


        const checkFavoriteStatus = async () => {
            if (!serviceId) return;
            setFavLoading(true);
            try {
                const res = await api.get(`/favorites/check/${serviceId}`);
                if (!isActive) return;
                if (res.data.status === 'success') {
                    setIsFavorite(res.data.isFavorite);
                }
            } catch (error) { /* Silently fail */ }
            finally {
                if (isActive) setFavLoading(false);
            }
        };

        if (!serviceId) {
            setLoading(false);
        } else {
            fetchService();
            checkFavoriteStatus();
        }

        return () => {
            isActive = false;
        };
    }, [serviceId]);

    const toggleFavorite = async () => {
        if (!serviceId || favLoading) return;
        setFavLoading(true);
        try {
            if (isFavorite) {
                await api.delete(`/favorites/${serviceId}`);
                setIsFavorite(false);
            } else {
                await api.post('/favorites', { service_id: serviceId });
                setIsFavorite(true);
            }
        } catch (error) {
            toast.error("Debes iniciar sesión para guardar favoritos.");
        } finally {
            setFavLoading(false);
        }
    };

    // Check Availability when Date Changes
    useEffect(() => {
        let isActive = true;

        const checkAvailability = async () => {
            if (!serviceId || !selectedDate) {
                setAvailableSlots([]);
                setAvailabilityMessage('');
                return;
            }
            setAvailableSlots([]);
            setAvailabilityMessage('Buscando horarios...');
            setSelectedTimes([]);

            try {
                const res = await api.get(`/bookings/availability`, {
                    params: { serviceId, date: selectedDate }
                });
                if (!isActive) return;

                if (res.data.status === 'success') {
                    const slots = res.data.availableSlots;
                    setAvailableSlots(slots);
                    if (slots.length === 0) {
                        setAvailabilityMessage(res.data.message || 'No hay horarios disponibles para este día.');
                    } else {
                        setAvailabilityMessage('');
                    }
                } else {
                    setAvailabilityMessage(res.data.message || 'No se pudo verificar disponibilidad.');
                }
            } catch (error: any) {
                if (!isActive) return;
                const msg = error.response?.data?.message || 'Error al verificar disponibilidad.';
                setAvailabilityMessage(msg);
            }
        };

        checkAvailability();
        return () => {
            isActive = false;
        };
    }, [selectedDate, serviceId]);

    const toggleTimeSelection = (time: string) => {
        if (service?.pricing_type === 'per_hour') {
            setSelectedTimes(prev =>
                prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time].sort()
            );
        } else {
            // Uniselection for per_event
            setSelectedTimes([time]);
        }
    };

    const handleBook = () => {
        if (!service) {
            toast.error('El servicio aun se esta cargando.');
            return;
        }
        if (!selectedDate || selectedTimes.length === 0) {
            toast.error('Por favor selecciona una fecha y al menos una hora.');
            return;
        }
        navigateTo('checkout', {
            service: service,
            booking: { date: selectedDate, times: selectedTimes }
        });
    };

    // === Freight booking handlers ===
    const isFreightService = service?.categories_json?.some((c: any) => c.categoryId === 'fletes') && service?.freight_base_price;

    const handleRouteCalculated = useCallback((data: {
        origin: GeoSearchResult;
        destination: GeoSearchResult;
        distanceKm: number;
        durationMinutes: number;
    }) => {
        setFreightRouteData(data);
        setFreightPlan(null);
    }, []);

    const handleFreightPlanSelected = useCallback((plan: LogisticsPlan) => {
        setFreightPlan(plan);
    }, []);

    const handleFreightPlanCleared = useCallback(() => {
        setFreightPlan(null);
    }, []);

    const handleFreightBook = () => {
        if (!service) {
            toast.error('El servicio aun se esta cargando.');
            return;
        }
        if (!freightRouteData || !freightPlan) {
            toast.error('Completa la ruta y selecciona un plan de logística.');
            return;
        }
        navigateTo('checkout', {
            service: service,
            booking: { date: new Date().toISOString().split('T')[0], times: ['a_convenir'] },
            freightData: {
                route: freightRouteData,
                plan: freightPlan,
            }
        });
    };

    // Calculate dynamic subtotal
    const getCalculatedPrice = () => {
        if (!service) return 0;
        if (service.pricing_type === 'per_hour' && selectedTimes.length > 0) {
            return service.price * selectedTimes.length;
        }
        return service.price;
    };    // Build gallery items for lightbox
    const buildGalleryItems = (): MediaItem[] => {
        if (!service) return [];
        const items: MediaItem[] = [];

        // 1. Cover image first (if exists)
        if (service.coverImageUrl) {
            items.push({ type: 'image', url: service.coverImageUrl });
        }

        // 2. Main video
        if (service.videoUrl) {
            items.push({ type: 'video', url: service.videoUrl });
        }

        // 3. Gallery media items
        if (service.galleryMedia && service.galleryMedia.length > 0) {
            service.galleryMedia.forEach((item: MediaItem) => {
                // Avoid duplicating cover or video
                if (item.url !== service.coverImageUrl && item.url !== service.videoUrl) {
                    items.push(item);
                }
            });
        }

        return items;
    };

    const galleryItems = service ? buildGalleryItems() : [];

    const openLightbox = (index: number) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    // Determine main display: cover image or video
    const mainImageUrl = service?.coverImageUrl || service?.images?.[0] || null;

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p>Cargando servicio...</p></div>;
    }

    if (!service) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p>Servicio no encontrado.</p></div>;
    }

    return (
        <div className="bg-gray-50 min-h-screen pb-12">
            {/* Breadcrumb / Back */}
            <div className="bg-white border-b border-gray-200">
                <div className="container mx-auto px-4 py-3">
                    <button onClick={() => navigateTo('search')} className="flex items-center text-sm text-gray-500 hover:text-gray-900">
                        Volver a resultados
                    </button>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Content */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Main Visual */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Main image/video area */}
                            <div
                                className="aspect-video w-full relative group bg-black cursor-pointer"
                                onClick={() => galleryItems.length > 0 && openLightbox(0)}
                            >
                                {service.videoUrl ? (
                                    <VideoPlayer
                                        url={service.videoUrl}
                                        poster={mainImageUrl}
                                    />
                                ) : mainImageUrl ? (
                                    <img src={mainImageUrl} alt={service.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                        <ImageIcon size={48} className="text-gray-300" />
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail strip */}
                            {galleryItems.length > 1 && (
                                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                        {galleryItems.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => openLightbox(idx)}
                                                className="relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 border-transparent hover:border-brand-primary transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md group/thumb"
                                            >
                                                {item.type === 'image' ? (
                                                    <img
                                                        src={item.thumbnail || item.url}
                                                        alt={`Galería ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                                        <Play size={20} className="text-white/70 group-hover/thumb:text-white group-hover/thumb:scale-110 transition-all" fill="rgba(255,255,255,0.5)" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                        {/* "View all" indicator */}
                                        {galleryItems.length > 5 && (
                                            <button
                                                onClick={() => openLightbox(0)}
                                                className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm hover:bg-gray-300 transition-colors"
                                            >
                                                +{galleryItems.length - 5}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex justify-between items-start">
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{service.title}</h1>
                                    <div className="flex space-x-2">
                                        <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><Share2 size={20} /></button>
                                        <button
                                            onClick={toggleFavorite}
                                            disabled={favLoading}
                                            className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isFavorite ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                                        >
                                            <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center mt-4 space-x-4 text-sm">
                                    <div className="flex items-center text-yellow-500 font-bold">
                                        <StarIcon className="h-5 w-5 fill-current mr-1" /> {service.provider.rating} <span className="text-gray-500 font-normal ml-1 underline decoration-dotted">({service.provider.reviews} reseñas)</span>
                                    </div>
                                    <div className="flex items-center text-gray-600">
                                        <MapPin size={16} className="mr-1" /> {service.location}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Provider Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between cursor-pointer" onClick={() => navigateTo('provider-profile', { id: service.provider.id })}>
                                <div className="flex items-center">
                                    <img src={service.provider.avatar} alt={service.provider.name} className="w-14 h-14 rounded-full object-cover border-2 border-gray-100" />
                                    <div className="ml-4">
                                        <h3 className="text-lg font-bold text-gray-900 hover:underline">{service.provider.name}</h3>
                                        <p className="text-sm text-gray-500 flex items-center">
                                            {service.provider.verified && <span className="flex items-center text-green-600 mr-2"><ShieldCheck size={14} className="mr-1" /> Identidad Verificada</span>}
                                        </p>
                                    </div>
                                </div>
                                <button className="text-brand-primary font-medium text-sm hover:bg-brand-primary/5 px-3 py-2 rounded-md transition-colors">Ver Perfil</button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Acerca de este servicio</h2>
                            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{service.description}</p>

                            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">¿Qué incluye?</h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {service.features.map((feature: string, idx: number) => (
                                    <li key={idx} className="flex items-center text-gray-700">
                                        <Check size={16} className="text-green-500 mr-2 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Reviews */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Opiniones de clientes</h2>
                            <p className="text-gray-500 text-sm">No hay opiniones todavía.</p>
                        </div>

                    </div>

                    {/* Right Column: Booking Widget (Sticky) */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                            <div className="p-6">

                                {/* ======= FREIGHT BOOKING FLOW ======= */}
                                {isFreightService ? (
                                    <>
                                        {/* Step indicator */}
                                        <div className="flex items-center justify-between mb-4">
                                            {[1, 2, 3].map((step) => (
                                                <div key={step} className="flex items-center">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                                        freightStep >= step
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-gray-200 text-gray-500'
                                                    }`}>
                                                        {step}
                                                    </div>
                                                    {step < 3 && (
                                                        <div className={`w-8 h-0.5 mx-1 ${freightStep > step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-4 text-center">
                                            {freightStep === 1 && '📍 Define la ruta del flete'}
                                            {freightStep === 2 && '📦 Estima tu carga y elige un plan'}
                                            {freightStep === 3 && '✅ Confirma tu reserva'}
                                        </p>

                                        {/* Step 1: Route Map */}
                                        {freightStep === 1 && (
                                            <>
                                                <FreightRouteMap
                                                    basePrice={service.freight_base_price}
                                                    pricePerKm={service.freight_price_per_km}
                                                    maxDistanceKm={1000}
                                                    onRouteCalculated={handleRouteCalculated}
                                                />
                                                {freightRouteData && (
                                                    <button
                                                        onClick={() => setFreightStep(2)}
                                                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center"
                                                    >
                                                        Continuar: Estimar Carga <ArrowRight size={18} className="ml-2" />
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* Step 2: Logistics Calculator */}
                                        {freightStep === 2 && freightRouteData && (
                                            <>
                                                {/* Route summary */}
                                                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                                                    <div className="flex justify-between text-gray-600">
                                                        <span>🛣️ {freightRouteData.distanceKm} km</span>
                                                        <span>⏱️ {freightRouteData.durationMinutes} min</span>
                                                    </div>
                                                </div>

                                                <FreightLogisticsCalculator
                                                    vehicles={freightVehicles}
                                                    basePrice={service.freight_base_price}
                                                    pricePerKm={service.freight_price_per_km}
                                                    distanceKm={freightRouteData.distanceKm}
                                                    onPlanSelected={handleFreightPlanSelected}
                                                    onPlanCleared={handleFreightPlanCleared}
                                                />

                                                <div className="flex gap-2 mt-4">
                                                    <button
                                                        onClick={() => setFreightStep(1)}
                                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all"
                                                    >
                                                        ← Ruta
                                                    </button>
                                                    {freightPlan && (
                                                        <button
                                                            onClick={() => setFreightStep(3)}
                                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all"
                                                        >
                                                            Confirmar →
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {/* Step 3: Confirmation Summary */}
                                        {freightStep === 3 && freightRouteData && freightPlan && (
                                            <>
                                                <div className="space-y-3 text-sm">
                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <p className="font-semibold text-gray-800 mb-1">📍 Ruta</p>
                                                        <p className="text-gray-600 text-xs">{freightRouteData.origin.address}</p>
                                                        <p className="text-gray-400 text-xs my-0.5">→</p>
                                                        <p className="text-gray-600 text-xs">{freightRouteData.destination.address}</p>
                                                        <p className="text-gray-500 text-xs mt-1">{freightRouteData.distanceKm} km · ~{freightRouteData.durationMinutes} min</p>
                                                    </div>

                                                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                                                        <p className="font-semibold text-gray-800 mb-1">📋 Plan seleccionado</p>
                                                        <p className="text-gray-600 text-xs">{freightPlan.explanation}</p>
                                                    </div>

                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-semibold text-gray-800">Estimacion referencial</span>
                                                            <span className="text-xl font-bold text-indigo-700">
                                                                ${freightPlan.price_breakdown.total.toLocaleString('es-CL')}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            El monto final del flete se confirma con cotizacion validada.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 mt-4">
                                                    <button
                                                        onClick={() => setFreightStep(2)}
                                                        className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all"
                                                    >
                                                        ← Atrás
                                                    </button>
                                                    <button
                                                        onClick={handleFreightBook}
                                                        className="flex-1 bg-brand-primary hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center"
                                                    >
                                                        <Truck size={18} className="mr-2" /> Reservar Flete
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    /* ======= STANDARD BOOKING FLOW ======= */
                                    <>
                                <div className="flex items-baseline mb-4">
                                    <span className="text-3xl font-bold text-gray-900">${service.price.toLocaleString('es-CL')}</span>
                                    <span className="text-gray-500 ml-2">/ servicio</span>
                                </div>

                                {/* Simplified Date Selection */}
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="date"
                                                min={new Date().toISOString().split('T')[0]}
                                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                                                onChange={(e) => setSelectedDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {service.pricing_type === 'per_hour' ? 'Bloques Horarios (Selecciona uno o más)' : 'Hora de Llegada (Selecciona una)'}
                                        </label>
                                        
                                        {!selectedDate ? (
                                            <div className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-md border border-gray-200">Selecciona una fecha primero</div>
                                        ) : availableSlots.length === 0 ? (
                                            <div className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-md border border-gray-200">No hay horas disponibles</div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {availableSlots.map(time => {
                                                    const isSelected = selectedTimes.includes(time);
                                                    return (
                                                        <button
                                                            key={time}
                                                            onClick={() => toggleTimeSelection(time)}
                                                            className={`px-3 py-2 text-sm rounded-md border font-medium transition-colors ${
                                                                isSelected 
                                                                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm' 
                                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-brand-primary hover:text-brand-primary'
                                                            }`}
                                                        >
                                                            {time}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {availabilityMessage && (
                                            <p className="text-xs text-orange-600 mt-2">{availabilityMessage}</p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleBook}
                                    disabled={!selectedDate || selectedTimes.length === 0}
                                    className="w-full bg-brand-primary hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                                >
                                    Reservar Ahora <ArrowRight size={18} className="ml-2" />
                                </button>
                                    </>
                                )}

                                <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100 flex items-start text-xs text-blue-800">
                                    <Lock size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                                    <p className="leading-snug">
                                        Por seguridad, el teléfono y correo del proveedor se mostrarán automáticamente una vez realizado el pago.
                                    </p>
                                </div>

                                <p className="text-center text-xs text-gray-400 mt-2">
                                    No se te cobrará nada hasta confirmar la disponibilidad.
                                </p>
                            </div>
                            <div className="bg-gray-50 p-4 border-t border-gray-200">
                                <div className="flex items-start">
                                    <ShieldCheck size={18} className="text-brand-secondary mt-0.5 mr-2 flex-shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900">Pago en Custodia (Escrow)</h4>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Tu dinero está seguro con Serviciosatuhogar. El proveedor solo recibe el pago cuando confirmas que el trabajo está terminado.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Lightbox */}
            <MediaLightbox
                items={galleryItems}
                initialIndex={lightboxIndex}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
            />

            {/* Scrollbar utility */}
            <style>{`
                .scrollbar-thin::-webkit-scrollbar { height: 4px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
            `}</style>
        </div>
    );
};

export default ServiceDetailPage;
