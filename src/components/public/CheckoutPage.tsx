import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../../types';
import type { LogisticsPlan } from '../../types';
import type { GeoSearchResult } from '../../services/geo/types';
import { ShieldCheck, Lock, CreditCard, ArrowRight, CheckCircle, ChevronLeft, User, Mail, Phone, LogIn, Save, UserPlus, Truck, MapPin, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import RegisterModal from '../auth/RegisterModal';
import LocationCoverageSelector from '../common/LocationCoverageSelector';
import toast from 'react-hot-toast';

interface CheckoutPageProps {
    navigateTo: (page: Page, params?: any) => void;
    service?: any;
    booking?: any;
    freightData?: {
        route: {
            origin: GeoSearchResult;
            destination: GeoSearchResult;
            distanceKm: number;
            durationMinutes: number;
        };
        plan: LogisticsPlan;
    };
}

interface PublicPricingQuote {
    baseAmount: number;
    serviceFee: number;
    totalAmount: number;
    units: number;
    currency: 'CLP';
    pricingVersion: number;
}

const parseServiceCommunes = (value: any): string[] => {
    if (Array.isArray(value)) {
        return value.map((commune) => String(commune || '').trim()).filter(Boolean);
    }

    if (typeof value !== 'string' || !value.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.map((commune) => String(commune || '').trim()).filter(Boolean)
            : [];
    } catch {
        return [];
    }
};

const isTimeSlot = (value: string | undefined) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');

const CheckoutPage: React.FC<CheckoutPageProps> = ({ navigateTo, service, booking, freightData }) => {
    const { isAuthenticated, user } = useAuthStore();

    // Steps: 0: Identification, 1: Review, 2: Payment, 3: Success
    const [step, setStep] = useState(0);
    const [processing, setProcessing] = useState(false);
    const idempotencyKeyRef = useRef(
        globalThis.crypto?.randomUUID?.() ||
        `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    // Register Modal State
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

    // Guest Data State
    const [guestData, setGuestData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
    });
    const [guestError, setGuestError] = useState('');
    const [selectedRegionCode, setSelectedRegionCode] = useState(service?.coverage_region_code || '');
    const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
    const selectedCommune = selectedCommunes[0] || '';
    const [pricingQuote, setPricingQuote] = useState<PublicPricingQuote | null>(null);
    const [pricingLoading, setPricingLoading] = useState(true);
    const [pricingError, setPricingError] = useState('');
    const [pricingRefreshKey, setPricingRefreshKey] = useState(0);

    // Detect if this is a freight booking
    const isFreight = !!freightData;
    const serviceCommunes = parseServiceCommunes(service?.coverage_communes);
    const requiresLocationConfirmation = service?.type !== 'online';
    const isCommuneAllowed = !requiresLocationConfirmation || (
        !!selectedCommune && serviceCommunes.includes(selectedCommune)
    );

    // The server owns pricing rules; the browser receives customer-facing totals only.
    const quoteUnits = service?.pricing_type === 'per_hour' ? Math.max(1, booking?.times?.length || 1) : 1;
    const basePrice = pricingQuote?.baseAmount ?? 0;
    const commission = pricingQuote?.serviceFee ?? 0;
    const total = pricingQuote?.totalAmount ?? 0;
    const commissionLabel = 'Tarifa de Servicio';
    const freightEstimate = isFreight && freightData ? freightData.plan.price_breakdown.total : null;

















    useEffect(() => {
        if (isAuthenticated && step === 0) {
            setStep(1);
        }
    }, [isAuthenticated, step]);

    useEffect(() => {
        setSelectedRegionCode(service?.coverage_region_code || '');
        setSelectedCommunes([]);
    }, [service?.id, service?.coverage_region_code]);

    useEffect(() => {
        let active = true;
        setPricingQuote(null);
        setPricingError('');

        if (!service?.id) {
            setPricingLoading(false);
            setPricingError('No se pudo identificar el servicio.');
            return () => { active = false; };
        }

        setPricingLoading(true);
        void api.get(`/services/${service.id}/quote`, { params: { units: quoteUnits } })
            .then((response) => {
                const quote = response.data?.pricing as PublicPricingQuote | undefined;
                if (!quote || !Number.isFinite(quote.totalAmount)) {
                    throw new Error('Invalid pricing quote');
                }
                if (active) setPricingQuote(quote);
            })
            .catch(() => {
                if (active) setPricingError('No pudimos calcular el total. Intenta nuevamente.');
            })
            .finally(() => {
                if (active) setPricingLoading(false);
            });

        return () => { active = false; };
    }, [service?.id, quoteUnits, pricingRefreshKey]);

    const handleGuestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setGuestError('');
        if (!guestData.firstName || !guestData.lastName || !guestData.email || !guestData.phone) {
            setGuestError('Por favor completa los datos obligatorios pendientes antes de pagar');
            toast.error('Por favor completa los datos obligatorios pendientes antes de pagar');
            return;
        }
        setStep(1);
    };

    const handleBookingCreation = async () => {
        setProcessing(true);
        try {
            if (!pricingQuote) {
                throw new Error(pricingError || 'El total aun no esta disponible.');
            }
            if (!service?.id || !booking?.date || (!booking?.time && (!booking?.times || booking.times.length === 0))) {
                throw new Error("Datos de reserva incompletos");
            }

            if (!isCommuneAllowed) {
                throw new Error('Selecciona una comuna valida para confirmar cobertura antes del pago.');
            }

            // Map old "time" or new "times" array
            const selectedTimesArray = booking.times || (booking.time ? [booking.time] : []);
            const firstTime = selectedTimesArray[0];
            const scheduledTime = isTimeSlot(firstTime) ? firstTime : '12:00';

            // Combine Date and Time into ISO string
            const scheduledDate = new Date(`${booking.date}T${scheduledTime}:00`).toISOString();

            let response;
            
            if (isAuthenticated) {
                const bookingPayload: any = {
                    service_id: service.id,
                    expected_pricing_version: pricingQuote.pricingVersion,
                    scheduled_date: scheduledDate,
                    booking_date: booking.date,
                    selected_times: selectedTimesArray,
                    service_region_code: selectedRegionCode || null,
                    service_region_name: service?.coverage_region_name || null,
                    service_commune: selectedCommune || null,
                };

                // Attach freight data if present
                if (isFreight && freightData) {
                    bookingPayload.freight_route = {
                        origin_address: freightData.route.origin.address,
                        origin_lat: freightData.route.origin.lat,
                        origin_lng: freightData.route.origin.lng,
                        dest_address: freightData.route.destination.address,
                        dest_lat: freightData.route.destination.lat,
                        dest_lng: freightData.route.destination.lng,
                        distance_km: freightData.route.distanceKm,
                        duration_minutes: freightData.route.durationMinutes,
                    };
                    bookingPayload.freight_logistics = freightData.plan;
                }

                response = await api.post('/bookings', bookingPayload, {
                    headers: { 'Idempotency-Key': idempotencyKeyRef.current },
                });
            } else {
                const guestPayload: any = {
                    service_id: service.id,
                    expected_pricing_version: pricingQuote.pricingVersion,
                    scheduled_date: scheduledDate,
                    booking_date: booking.date,
                    selected_times: selectedTimesArray,
                    service_region_code: selectedRegionCode || null,
                    service_region_name: service?.coverage_region_name || null,
                    service_commune: selectedCommune || null,
                    guest_name: `${guestData.firstName} ${guestData.lastName}`,
                    guest_email: guestData.email,
                    guest_phone: guestData.phone,
                };

                if (isFreight && freightData) {
                    guestPayload.freight_route = {
                        origin_address: freightData.route.origin.address,
                        origin_lat: freightData.route.origin.lat,
                        origin_lng: freightData.route.origin.lng,
                        dest_address: freightData.route.destination.address,
                        dest_lat: freightData.route.destination.lat,
                        dest_lng: freightData.route.destination.lng,
                        distance_km: freightData.route.distanceKm,
                        duration_minutes: freightData.route.durationMinutes,
                    };
                    guestPayload.freight_logistics = freightData.plan;
                }

                response = await api.post('/bookings/guest', guestPayload, {
                    headers: { 'Idempotency-Key': idempotencyKeyRef.current },
                });
            }

            if (response.data.status === 'success') {
                // Booking created!

                // Check if we have a Payment URL (Payku Integration)
                if (response.data.paymentUrl) {
                    // Redirect to Payku (or Mock)
                    window.location.href = response.data.paymentUrl;
                } else {
                    // Fallback for Phase 6/7 manual simulation if no URL
                    setTimeout(() => {
                        setProcessing(false);
                        setStep(3);
                    }, 1500);
                }
            }
        } catch (err: any) {
            setProcessing(false);
            if (err.response?.data?.code === 'PRICE_CHANGED') {
                setPricingQuote(null);
                setPricingError('El precio cambio mientras revisabas la reserva. Revisa el nuevo total antes de continuar.');
                setPricingRefreshKey((current) => current + 1);
                idempotencyKeyRef.current = globalThis.crypto?.randomUUID?.()
                    || `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                setStep(1);
                toast.error('El precio del servicio cambio. Revisa el nuevo total antes de pagar.');
                return;
            }
            toast.error(err.response?.data?.message || err.message || 'Error al crear la reserva');
        }
    };

    if (!service) {
        return <div className="p-8 text-center text-gray-500">No se ha seleccionado un servicio. <button onClick={() => navigateTo('home')} className="underline">Volver</button></div>;
    }

    // --- STEP 3: SUCCESS ---
    if (step === 3) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-lg w-full space-y-6">
                    {/* Success Card */}
                    <div className="bg-white p-10 rounded-xl shadow-lg text-center">
                        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">¡Reserva Solicitada!</h2>
                        <p className="text-gray-600 mt-2">
                            Tu solicitud ha sido enviada al proveedor. El dinero se mantendrá en custodia hasta que el trabajo esté finalizado.
                        </p>
                        <div className="mt-6 border-t border-gray-200 pt-6 text-left bg-gray-50 p-4 rounded-md">
                            <p className="text-sm font-medium text-gray-500">Servicio: {service.title}</p>
                            <p className="text-sm text-gray-900 mt-1">Hemos enviado los detalles a tu correo.</p>
                        </div>
                        <button
                            onClick={() => navigateTo('client-dashboard')}
                            className="mt-8 w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                        >
                            Ir a Mis Reservas
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="mb-8">
                    <button onClick={() => navigateTo('search')} className="text-gray-500 hover:text-gray-800 flex items-center text-sm mb-4">
                        <ChevronLeft size={16} className="mr-1" /> Cancelar y volver
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Finalizar Contratación</h1>

                    {/* Stepper */}
                    <div className="flex items-center mt-6 overflow-x-auto">
                        <div className={`flex items-center ${step >= 0 ? 'text-brand-primary' : 'text-gray-400'}`}>
                            <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 0 ? 'border-brand-primary bg-white' : 'border-gray-300'} font-bold mr-2 flex-shrink-0`}>1</span>
                            <span className="font-medium whitespace-nowrap">Identificación</span>
                        </div>
                        <div className={`w-12 h-0.5 mx-4 ${step >= 1 ? 'bg-brand-primary' : 'bg-gray-300'} flex-shrink-0`}></div>
                        <div className={`flex items-center ${step >= 1 ? 'text-brand-primary' : 'text-gray-400'}`}>
                            <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 1 ? 'border-brand-primary bg-white' : 'border-gray-300'} font-bold mr-2 flex-shrink-0`}>2</span>
                            <span className="font-medium whitespace-nowrap">Resumen</span>
                        </div>
                        <div className={`w-12 h-0.5 mx-4 ${step >= 2 ? 'bg-brand-primary' : 'bg-gray-300'} flex-shrink-0`}></div>
                        <div className={`flex items-center ${step >= 2 ? 'text-brand-primary' : 'text-gray-400'}`}>
                            <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 2 ? 'border-brand-primary bg-white' : 'border-gray-300'} font-bold mr-2 flex-shrink-0`}>3</span>
                            <span className="font-medium whitespace-nowrap">Pago</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* STEP 0: IDENTIFICATION */}
                        {step === 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Option A: Login / Register */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center text-center relative overflow-hidden">
                                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-brand-primary to-orange-400"></div>
                                    <div className="bg-orange-50 p-4 rounded-full mb-4">
                                        <LogIn className="h-8 w-8 text-brand-primary" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">¿Ya tienes cuenta?</h2>
                                    <p className="text-gray-600 mb-6 text-sm">
                                        Ahorra tiempo usando tus métodos de pago guardados y acumula puntos en cada servicio.
                                    </p>
                                    <button
                                        onClick={() => navigateTo('login', { returnTo: 'checkout', returnState: { service, booking, freightData } })}
                                        className="w-full bg-white border-2 border-brand-primary text-brand-primary font-bold py-3 px-4 rounded-lg hover:bg-orange-50 transition-colors mb-3"
                                    >
                                        Iniciar Sesión
                                    </button>
                                    <div className="relative w-full flex items-center justify-center my-4">
                                        <div className="absolute border-t border-gray-200 w-full"></div>
                                        <div className="relative bg-white px-2 text-xs text-gray-400 font-medium uppercase tracking-wider">o</div>
                                    </div>
                                    <button
                                        onClick={() => setIsRegisterModalOpen(true)}
                                        className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-sm"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Crear Nueva Cuenta
                                    </button>
                                </div>

                                {/* Option B: Guest Checkout */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                        <User className="mr-2 text-gray-400" size={24} /> Continuar como invitado
                                    </h2>
                                    {guestError && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm flex font-medium">{guestError}</div>}
                                    <form onSubmit={handleGuestSubmit} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                                    value={guestData.firstName}
                                                    onChange={(e) => setGuestData({ ...guestData, firstName: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                                    value={guestData.lastName}
                                                    onChange={(e) => setGuestData({ ...guestData, lastName: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                                            <input
                                                type="email"
                                                required
                                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                                value={guestData.email}
                                                onChange={(e) => setGuestData({ ...guestData, email: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Móvil</label>
                                            <input
                                                type="tel"
                                                required
                                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                                value={guestData.phone}
                                                onChange={(e) => setGuestData({ ...guestData, phone: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-6 shadow-sm flex items-center justify-center gap-2"
                                        >
                                            Continuar a Pagar
                                            <ArrowRight className="w-4 h-4 text-gray-300" />
                                        </button>
                                        <p className="text-xs text-gray-500 text-center mt-3">
                                            No se creará una cuenta ni se guardará tu información para futuras compras.
                                        </p>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* STEP 1: REVIEW */}
                        {step === 1 && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-gray-900">Revisa tu pedido</h2>
                                    <div className="text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                        Identificado como: <span className="text-gray-900">{user?.email || guestData.email}</span>
                                    </div>
                                </div>

                                <div className="flex gap-4 mb-6">
                                    {service.images && service.images[0] && (
                                        <img
                                            src={service.images[0]}
                                            alt={service.title}
                                            loading="lazy"
                                            decoding="async"
                                            width="192"
                                            height="192"
                                            className="w-24 h-24 rounded-md object-cover"
                                        />
                                    )}
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900">{service.title}</h3>
                                        {service.provider && <p className="text-gray-600">Proveedor: {service.provider.name}</p>}

                                        {/* Standard booking details */}
                                        {!isFreight && booking && (
                                            <p className="text-sm text-brand-primary font-medium mt-1">
                                                Fecha: {booking.date} 
                                                <br/>
                                                {service.pricing_type === 'per_hour' && booking.times?.length > 0 
                                                  ? `Horas seleccionadas: ${booking.times.join(', ')} (${booking.times.length} hrs)`
                                                  : `Hora de llegada: ${booking.time || (booking.times && booking.times[0])}`}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Freight-specific details */}
                                {isFreight && freightData && (
                                    <div className="space-y-3 mb-6">
                                        {/* Route */}
                                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <h4 className="text-sm font-bold text-gray-800 flex items-center mb-2">
                                                <MapPin size={16} className="mr-2 text-indigo-600" /> Ruta del Flete
                                            </h4>
                                            <div className="text-sm text-gray-600">
                                                <p className="flex items-start mb-1">
                                                    <span className="text-green-600 mr-2 mt-0.5">●</span>
                                                    {freightData.route.origin.address}
                                                </p>
                                                <p className="flex items-start">
                                                    <span className="text-red-600 mr-2 mt-0.5">●</span>
                                                    {freightData.route.destination.address}
                                                </p>
                                            </div>
                                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                                <span>🛣️ {freightData.route.distanceKm} km</span>
                                                <span>⏱️ ~{freightData.route.durationMinutes} min</span>
                                            </div>
                                        </div>

                                        {/* Logistics Plan */}
                                        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                                            <h4 className="text-sm font-bold text-gray-800 flex items-center mb-2">
                                                <Truck size={16} className="mr-2 text-indigo-600" /> Plan de Logística
                                            </h4>
                                            <p className="text-sm text-gray-600 mb-2">{freightData.plan.explanation}</p>
                                            <div className="text-xs text-gray-500 space-y-1">
                                                {freightData.plan.vehicles.map((v, i) => (
                                                    <p key={i}>🚛 {v.name} ({v.volume_m3} m³)</p>
                                                ))}
                                                {freightData.plan.trips_count > 1 && (
                                                    <p>× {freightData.plan.trips_count} viajes</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Freight estimate */}
                                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <h4 className="text-sm font-bold text-gray-800 mb-2">Estimacion logistica referencial</h4>
                                            <div className="text-sm space-y-1">
                                                <div className="flex justify-between text-gray-600">
                                                    <span>Valor base × {freightData.plan.price_breakdown.units}</span>
                                                    <span>${(freightData.plan.price_breakdown.base_per_unit * freightData.plan.price_breakdown.units).toLocaleString('es-CL')}</span>
                                                </div>
                                                <div className="flex justify-between text-gray-600">
                                                    <span>{freightData.route.distanceKm} km × ${freightData.plan.price_breakdown.price_per_km.toLocaleString('es-CL')}/km × {freightData.plan.price_breakdown.km_multiplier}</span>
                                                    <span>${(freightData.route.distanceKm * freightData.plan.price_breakdown.price_per_km * freightData.plan.price_breakdown.km_multiplier).toLocaleString('es-CL')}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                                                    <span>Estimacion flete</span>
                                                    <span>${freightData.plan.price_breakdown.total.toLocaleString('es-CL')}</span>
                                                </div>
                                                <p className="pt-2 text-xs text-gray-500">
                                                    Este monto es referencial y no se incluye en el pago online hasta contar con cotizacion validada.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {requiresLocationConfirmation && (
                                    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-5">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="mt-0.5 h-6 w-6 flex-shrink-0 text-orange-600" />
                                            <div className="min-w-0 flex-1 space-y-4">
                                                <div>
                                                    <h3 className="font-bold text-orange-900">Confirma la cobertura</h3>
                                                    <p className="mt-1 text-sm text-orange-800">
                                                        Selecciona la comuna donde necesitas que se realice el servicio.
                                                    </p>
                                                </div>

                                                <LocationCoverageSelector
                                                    regionCode={selectedRegionCode}
                                                    communes={selectedCommunes}
                                                    onRegionChange={setSelectedRegionCode}
                                                    onCommunesChange={setSelectedCommunes}
                                                    mode="single"
                                                    label="Localidad donde necesitas el servicio"
                                                    helperText="Validaremos que el proveedor atienda esta comuna antes del pago."
                                                    required
                                                />

                                                {serviceCommunes.length === 0 ? (
                                                    <div className="flex items-start rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                                                        <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                                                        <span>Este proveedor aun no tiene comunas configuradas para validar cobertura.</span>
                                                    </div>
                                                ) : selectedCommune && isCommuneAllowed ? (
                                                    <div className="flex items-start rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                                        <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                                                        <span>Cobertura confirmada para {selectedCommune}.</span>
                                                    </div>
                                                ) : selectedCommune ? (
                                                    <div className="flex items-start rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                                                        <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                                                        <span>El proveedor no atiende {selectedCommune}. Elige una comuna dentro de su cobertura.</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-6">
                                    <div className="flex">
                                        <ShieldCheck className="text-blue-600 h-6 w-6 mr-3 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-blue-800">Pago y liberación controlados</h4>
                                            <p className="text-sm text-blue-700 mt-1">El pago se registra y libera según el estado de la reserva y las condiciones informadas. Consulta los <a href="/legal/terminos-y-condiciones-de-uso" className="underline">términos de uso</a> antes de confirmar.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => navigateTo('home')}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!isCommuneAllowed}
                                        className={`font-bold py-3 px-6 rounded-lg flex items-center transition-colors ${
                                            isCommuneAllowed
                                                ? 'bg-brand-primary hover:bg-orange-600 text-white'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        Continuar al Pago <ArrowRight size={20} className="ml-2" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: PAYMENT */}
                        {step === 2 && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center"><Lock size={20} className="mr-2 text-green-600" /> Procesar pago</h2>

                                {/* Simulated Payku Form */}
                                <div className="space-y-4 max-w-md">
                                    <div className="p-4 border rounded-md bg-gray-50 flex items-center justify-between mb-4">
                                        <span className="font-medium text-gray-700">Métodos de Pago</span>
                                        <div className="flex space-x-2 items-center">
                                            <div className="h-6 w-10 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">Visa</div>
                                            <div className="h-6 w-10 bg-red-500 rounded flex items-center justify-center text-white text-xs font-bold">MC</div>
                                            <div className="h-6 w-auto px-2 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">Webpay</div>
                                        </div>
                                    </div>

                                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
                                        <p className="flex items-center"><ShieldCheck size={16} className="mr-2 text-blue-600" /> Serás redirigido a Payku para completar tu pago de forma segura.</p>
                                    </div>
                                    <div className="text-sm text-green-800 bg-green-50 p-3 rounded border border-green-200">
                                        <p className="flex items-start"><CheckCircle size={16} className="mr-2 mt-0.5 text-green-600 flex-shrink-0" /> Una vez confirmado el pago, recibirás de inmediato los datos de contacto directo del profesional (email y teléfono) para coordinar el trabajo.</p>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between items-center">
                                    <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-800 font-medium">Atrás</button>
                                    <button
                                        onClick={handleBookingCreation}
                                        disabled={processing || pricingLoading || !pricingQuote}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {pricingLoading ? 'Calculando...' : processing ? 'Procesando...' : `Pagar $${total.toLocaleString('es-CL')}`}
                                    </button>
                                </div>
                                <div className="mt-4 text-center">
                                    <p className="text-xs text-gray-400 flex items-center justify-center"><Lock size={12} className="mr-1" /> Transacción encriptada de extremo a extremo</p>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Summary Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                {isFreight ? '🚛 Resumen del Flete' : 'Resumen de Pago'}
                            </h3>
                            {pricingLoading && (
                                <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">Calculando total seguro...</div>
                            )}
                            {pricingError && (
                                <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{pricingError}</div>
                            )}
                            <div className="space-y-3 text-sm border-b border-gray-200 pb-4 mb-4">
                                {isFreight && freightData ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Pago online del servicio</span>
                                            <span className="font-medium text-gray-900">${basePrice.toLocaleString('es-CL')}</span>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            Estimacion logistica referencial: ${freightData.plan.price_breakdown.total.toLocaleString('es-CL')} · {freightData.route.distanceKm} km · {freightData.plan.trips_count} viaje(s) · {freightData.plan.vehicles.length} vehiculo(s)
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            {service.title} {service.pricing_type === 'per_hour' && booking?.times?.length > 0 ? ` (x ${booking.times.length} hrs)` : ''}
                                        </span>
                                        <span className="font-medium text-gray-900">${basePrice.toLocaleString('es-CL')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-600">{commissionLabel}</span>
                                    <span className="font-medium text-gray-900">${commission.toLocaleString('es-CL')}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-lg font-bold text-gray-900">{isFreight ? 'Total a pagar ahora' : 'Total a Pagar'}</span>
                                <span className="text-xl font-bold text-brand-primary">${total.toLocaleString('es-CL')}</span>
                            </div>
                            {isFreight && freightEstimate !== null && (
                                <div className="mb-4 rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                                    El flete estimado de ${freightEstimate.toLocaleString('es-CL')} queda guardado como referencia para coordinar la cotizacion final.
                                </div>
                            )}
                            <div className="text-xs text-gray-500">
                                * Al confirmar, aceptas los Términos y Condiciones de Serviciosatuhogar.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <RegisterModal
                isOpen={isRegisterModalOpen}
                onClose={() => setIsRegisterModalOpen(false)}
                onSuccess={() => {
                    setIsRegisterModalOpen(false);
                    setStep(1);
                }}
            />
        </div>
    );
};

export default CheckoutPage;
