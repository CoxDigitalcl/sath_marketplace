import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Star, AlertCircle, Clock } from 'lucide-react';
import { api } from '../../../api/client';

interface ScheduledBooking {
    id: string;
    item_name: string;
    customer_name: string; // Provider name for clients
    date: string;
    scheduled_date: string;
    amount: number;
    status: string;
    raw_status: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const stylesMap: Record<string, string> = {
        'Pendiente': 'bg-yellow-100 text-yellow-800',
        'Confirmado': 'bg-blue-100 text-blue-800',
        'Entregado': 'bg-green-100 text-green-800',
        'Completado': 'bg-green-100 text-green-800',
        'Cancelado': 'bg-red-100 text-red-800',
    };
    const style = stylesMap[status] || 'bg-gray-100 text-gray-600';
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style}`}>{status}</span>;
};

const ClientScheduledServices: React.FC = () => {
    const [bookings, setBookings] = useState<ScheduledBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Sin fecha';
        return new Date(dateString).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTime = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                setLoading(true);
                const response = await api.get('/bookings');
                if (response.data.status === 'success') {
                    // Filter bookings that have a scheduled_date and are not cancelled
                    const scheduled = (response.data.bookings || []).filter(
                        (b: ScheduledBooking) => b.scheduled_date && b.raw_status !== 'cancelled'
                    );
                    setBookings(scheduled);
                } else {
                    setError(response.data.message || 'Error al cargar servicios');
                }
            } catch (err: any) {
                console.error('Error fetching scheduled services:', err);
                setError(err.response?.data?.message || 'Error de conexión');
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, []);

    // Get days in month for calendar
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const monthName = currentMonth.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    // Check if a day has a booking
    const hasBookingOnDay = (day: number) => {
        return bookings.some(b => {
            const bookingDate = new Date(b.scheduled_date);
            return bookingDate.getDate() === day &&
                bookingDate.getMonth() === currentMonth.getMonth() &&
                bookingDate.getFullYear() === currentMonth.getFullYear();
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Servicios Agendados</h1>
                    <p className="mt-1 text-gray-600">Administra tus próximas citas y revisa el historial de servicios realizados.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                        <div className="h-4 w-48 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Servicios Agendados</h1>
                    <p className="mt-1 text-gray-600">Administra tus próximas citas y revisa el historial de servicios realizados.</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Servicios Agendados</h1>
                <p className="mt-1 text-gray-600">Administra tus próximas citas y revisa el historial de servicios realizados.</p>
            </div>

            {/* Calendar View */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-lg font-semibold capitalize">{monthName}</h2>
                    <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100">
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-sm">
                    {/* Day headers */}
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="text-xs font-medium text-gray-500 py-1">{day}</div>
                    ))}
                    {/* Calendar Days */}
                    {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
                        const day = i + 1;
                        const hasBooking = hasBookingOnDay(day);
                        const isToday = new Date().getDate() === day &&
                            new Date().getMonth() === currentMonth.getMonth() &&
                            new Date().getFullYear() === currentMonth.getFullYear();
                        return (
                            <div
                                key={i}
                                className={`p-2 border rounded-md cursor-default ${hasBooking ? 'bg-brand-primary/10 border-brand-primary' : ''} ${isToday ? 'ring-2 ring-brand-primary' : ''}`}
                            >
                                {day}
                                {hasBooking && <div className="mt-1 mx-auto h-1.5 w-1.5 bg-brand-primary rounded-full"></div>}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Bookings Table */}
            {bookings.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes servicios agendados</h3>
                    <p className="text-gray-500">Cuando agendes un servicio, aparecerá aquí.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha y Hora</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {bookings.map(booking => (
                                    <tr key={booking.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{formatDate(booking.scheduled_date)}</div>
                                            <div className="text-sm text-gray-500">{formatTime(booking.scheduled_date)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{booking.item_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{booking.customer_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={booking.status} /></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {(booking.raw_status === 'confirmed' || booking.raw_status === 'pending_payment') && (
                                                <button className="text-red-600 hover:text-red-800">Cancelar Reserva</button>
                                            )}
                                            {booking.raw_status === 'completed' && (
                                                <button className="text-brand-primary hover:text-orange-600 flex items-center gap-1">
                                                    <Star size={16} /> Dejar Review
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientScheduledServices;