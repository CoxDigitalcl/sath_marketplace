import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, ArrowRight, Package, Calendar, Phone, Mail, Loader2, Star, Bell, Shield, CreditCard, UserPlus, Clock } from 'lucide-react';
import { Page } from '../../types';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

interface CheckoutSuccessPageProps {
    navigateTo: (page: Page) => void;
}

const CheckoutSuccessPage: React.FC<CheckoutSuccessPageProps> = ({ navigateTo }) => {
    const { isAuthenticated } = useAuthStore();
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [verifying, setVerifying] = useState(true);
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);
    const pollCountRef = useRef(0);
    const maxPolls = 10;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('order') || params.get('id');
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const capability = fragment.get('cap');
        let interval: ReturnType<typeof setInterval> | undefined;
        let active = true;

        if (window.location.hash) {
            window.history.replaceState(
                null,
                document.title,
                `${window.location.pathname}${window.location.search}`
            );
        }

        if (!orderId || !capability) {
            setOrderDetails(orderId ? { id: orderId } : null);
            setVerifying(false);
            return undefined;
        }

        const requestConfig = {
            headers: { 'X-Booking-Capability': capability },
        };

        const verifyPayment = async () => {
            try {
                const res = await api.get(`/bookings/verify/${orderId}`, requestConfig);
                if (!active) return false;
                if (res.data.status === 'success' && res.data.payment_confirmed && res.data.booking) {
                    setOrderDetails(res.data.booking);
                    setPaymentConfirmed(true);
                    setVerifying(false);
                    return true;
                }
                return false;
            } catch (err) {
                console.error('[CheckoutSuccess] Verify error:', err);
                return false;
            }
        };

        const fetchPublicBooking = async () => {
            try {
                const res = await api.get(`/bookings/public/${orderId}`, requestConfig);
                if (!active) return;
                if (res.data.status === 'success') {
                    setOrderDetails(res.data.booking);
                    if (res.data.booking.provider_email) setPaymentConfirmed(true);
                }
            } catch {
                if (active) setOrderDetails({ id: orderId });
            }
        };

        const startPolling = async () => {
            if (await verifyPayment()) return;
            if (!active) return;

            interval = setInterval(async () => {
                pollCountRef.current += 1;
                if (pollCountRef.current >= maxPolls) {
                    if (interval) clearInterval(interval);
                    setVerifying(false);
                    await fetchPublicBooking();
                    return;
                }
                if (await verifyPayment() && interval) clearInterval(interval);
            }, 3000);
        };

        void startPolling();
        return () => {
            active = false;
            if (interval) clearInterval(interval);
        };
    }, []);

    // Helper: format date nicely
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('es-CL', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch { return dateStr; }
    };

    // Helper: format times
    const formatTimes = (times: any) => {
        if (!times) return '';
        if (Array.isArray(times)) return times.join(', ');
        try {
            const parsed = JSON.parse(times);
            return Array.isArray(parsed) ? parsed.join(', ') : times;
        } catch { return String(times); }
    };

    const isGuest = !isAuthenticated;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl w-full space-y-6">

                {/* ========== SUCCESS CARD ========== */}
                <div className="bg-white p-8 sm:p-10 rounded-xl shadow-lg text-center">
                    <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-brand-primary/10 mb-6">
                        <CheckCircle className="h-14 w-14 text-brand-primary" />
                    </div>

                    <h2 className="text-3xl font-extrabold text-gray-900">¡Pago Exitoso!</h2>
                    <p className="text-gray-600 mt-3 text-lg">
                        Tu reserva ha sido confirmada y el pago procesado correctamente.
                    </p>

                    {/* Loading state */}
                    {verifying && !paymentConfirmed && (
                        <div className="mt-6 bg-blue-50 p-5 rounded-lg border border-blue-200 text-left">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-blue-900">Verificando pago...</h3>
                                    <p className="text-sm text-blue-700 mt-1">Estamos confirmando tu transacción con el procesador de pagos. Los datos del proveedor se mostrarán en un instante.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Order ID (when verification timed out) */}
                    {orderDetails?.id && !paymentConfirmed && !verifying && (
                        <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500">Número de Orden</p>
                            <p className="font-mono font-bold text-gray-900">
                                {typeof orderDetails.id === 'string' && orderDetails.id.length > 12
                                    ? orderDetails.id.slice(0, 8).toUpperCase() + '...'
                                    : orderDetails.id}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                {isGuest
                                    ? 'Los datos de contacto del proveedor serán enviados al correo que proporcionaste.'
                                    : 'Los datos de contacto del proveedor serán enviados a tu correo electrónico.'}
                            </p>
                        </div>
                    )}

                    {/* ========== BOOKING DETAILS (visible for all after confirmation) ========== */}
                    {paymentConfirmed && orderDetails && (
                        <div className="mt-6 space-y-4 text-left">
                            {/* Service & Schedule Info */}
                            {(orderDetails.service_title || orderDetails.scheduled_date) && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 flex items-center mb-3">
                                        <Clock size={18} className="mr-2 text-gray-400" />
                                        Detalles de tu Reserva
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        {orderDetails.service_title && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Servicio</span>
                                                <span className="font-medium text-gray-900">{orderDetails.service_title}</span>
                                            </div>
                                        )}
                                        {orderDetails.scheduled_date && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Fecha</span>
                                                <span className="font-medium text-gray-900">{formatDate(orderDetails.scheduled_date)}</span>
                                            </div>
                                        )}
                                        {orderDetails.selected_times && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Horario</span>
                                                <span className="font-medium text-gray-900">{formatTimes(orderDetails.selected_times)}</span>
                                            </div>
                                        )}
                                        {orderDetails.amount && (
                                            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                                                <span className="text-gray-500">Monto pagado</span>
                                                <span className="font-bold text-brand-primary">${Number(orderDetails.amount).toLocaleString('es-CL')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Provider Contact Details */}
                            {orderDetails.provider_email && (
                                <div className="bg-green-50 p-5 rounded-lg border border-green-200 shadow-sm">
                                    <h3 className="font-bold text-green-900 flex items-center mb-3">
                                        <CheckCircle size={20} className="mr-2 text-green-600" />
                                        Datos del Profesional
                                    </h3>
                                    <p className="text-sm text-green-800 mb-4">Contacta al proveedor para coordinar la entrega del servicio.</p>

                                    <div className="space-y-3 bg-white p-4 rounded-md border border-green-100">
                                        <p className="font-semibold text-gray-900">{orderDetails.provider_name}</p>
                                        {orderDetails.provider_phone && (
                                            <div className="flex items-center text-gray-700">
                                                <Phone size={16} className="text-green-600 mr-2 flex-shrink-0" />
                                                <a href={`tel:${orderDetails.provider_phone}`} className="hover:text-green-700 font-medium">{orderDetails.provider_phone}</a>
                                            </div>
                                        )}
                                        <div className="flex items-center text-gray-700">
                                            <Mail size={16} className="text-green-600 mr-2 flex-shrink-0" />
                                            <a href={`mailto:${orderDetails.provider_email}`} className="hover:text-green-700 font-medium">{orderDetails.provider_email}</a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info Cards */}
                    <div className="mt-8 grid grid-cols-2 gap-4 text-left">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <Package className="h-6 w-6 text-blue-600 mb-2" />
                            <h4 className="font-semibold text-blue-900">Pago Protegido</h4>
                            <p className="text-xs text-blue-800 mt-1">Tu dinero está seguro en custodia hasta la confirmación de la entrega del servicio.</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                            <Calendar className="h-6 w-6 text-orange-600 mb-2" />
                            <h4 className="font-semibold text-orange-900">Coordinación</h4>
                            <p className="text-xs text-orange-800 mt-1">
                                {paymentConfirmed && orderDetails?.provider_name
                                    ? `Escríbele a ${orderDetails.provider_name} usando los datos de arriba.`
                                    : 'El proveedor te contactará para afinar los detalles.'}
                            </p>
                        </div>
                    </div>

                    {/* ========== ACTIONS: Different for registered vs guest ========== */}
                    {isAuthenticated ? (
                        /* REGISTERED USER ACTIONS */
                        <div className="mt-8 space-y-3">
                            <button
                                onClick={() => navigateTo('client-dashboard')}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-brand-primary hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                            >
                                Ver Mis Reservas <ArrowRight size={20} className="ml-2" />
                            </button>
                            <button
                                onClick={() => navigateTo('home')}
                                className="w-full py-3 px-4 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                            >
                                Volver al Inicio
                            </button>
                        </div>
                    ) : (
                        /* GUEST USER ACTIONS */
                        <div className="mt-8 space-y-3">
                            <button
                                onClick={() => navigateTo('home')}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-brand-primary hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                            >
                                Explorar Más Servicios <ArrowRight size={20} className="ml-2" />
                            </button>
                        </div>
                    )}
                </div>

                {/* ========== GUEST-ONLY: Registration CTA Landing ========== */}
                {isGuest && (
                    <div className="bg-white p-8 rounded-xl shadow-lg border border-orange-100 relative overflow-hidden">
                        {/* Decorative gradient bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-brand-primary to-orange-500"></div>

                        <div className="text-center mb-6">
                            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-orange-50 mb-4">
                                <UserPlus className="h-7 w-7 text-brand-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">¿Te gustó la experiencia?</h3>
                            <p className="text-gray-600 mt-2">Crea tu cuenta gratuita y desbloquea beneficios exclusivos para tus próximas contrataciones.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <Star className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Reseñas</p>
                                    <p className="text-xs text-gray-500">Califica a los proveedores y ayuda a la comunidad</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <Clock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Historial</p>
                                    <p className="text-xs text-gray-500">Todas tus reservas organizadas en un solo lugar</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <Bell className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Notificaciones</p>
                                    <p className="text-xs text-gray-500">Avisos en tiempo real sobre tus servicios</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <Shield className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Disputas</p>
                                    <p className="text-xs text-gray-500">Gestiona reclamos directo desde tu panel</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => navigateTo('client-register')}
                            className="w-full flex justify-center items-center py-3.5 px-4 rounded-lg shadow-md text-base font-bold text-white bg-gradient-to-r from-orange-500 to-brand-primary hover:from-orange-600 hover:to-orange-600 transition-all transform hover:scale-[1.01]"
                        >
                            <UserPlus size={20} className="mr-2" />
                            Crear Mi Cuenta Gratis
                        </button>
                        <p className="text-center text-xs text-gray-400 mt-3">Sin compromiso. Toma menos de 1 minuto.</p>
                    </div>
                )}

                {/* Footer Note */}
                <p className="text-center text-sm text-gray-500">
                    {isGuest
                        ? 'Hemos enviado todos los detalles de tu reserva y los datos del proveedor al correo que proporcionaste. Guárdalo como respaldo.'
                        : 'Hemos enviado los detalles de la reserva a tu correo electrónico.'}
                </p>
            </div>
        </div>
    );
};

export default CheckoutSuccessPage;
