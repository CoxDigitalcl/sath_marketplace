import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceBooking } from '../../../types';
import { ChevronLeft, ChevronRight, Clock, User, MoreVertical, Calendar as CalendarIcon, X, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';

interface ServiceCalendarProps {
    bookings: ServiceBooking[];
    onBookingUpdate?: () => void;
}

// Booking Detail Modal
const BookingDetailModal: React.FC<{
    booking: ServiceBooking;
    onClose: () => void;
    onAccept: () => void;
    isAccepting: boolean;
}> = ({ booking, onClose, onAccept, isAccepting }) => {
    const getStatusLabel = (status: ServiceBooking['status']) => {
        switch (status) {
            case 'confirmed': return 'Confirmado';
            case 'pending': return 'Pendiente';
            case 'cancelled': return 'Cancelado';
            case 'completed': return 'Completado';
            case 'no_show': return 'No Show';
            default: return status;
        }
    };

    const getStatusStyle = (status: ServiceBooking['status']) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-700';
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            case 'completed': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-secondary to-green-600 text-white p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm opacity-80">Reserva</p>
                            <h3 className="text-xl font-bold">{booking.serviceName}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3 text-gray-700">
                        <Clock size={20} className="text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-500">Horario</p>
                            <p className="font-semibold">{booking.startTime} - {booking.endTime}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-gray-700">
                        <CalendarIcon size={20} className="text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-500">Fecha</p>
                            <p className="font-semibold">{new Date(booking.date).toLocaleDateString('es-CL', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                            })}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-gray-700">
                        <User size={20} className="text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-500">Cliente</p>
                            <p className="font-semibold">{booking.customerName}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <p className="text-sm text-gray-500 mb-1">Estado</p>
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(booking.status)}`}>
                            {getStatusLabel(booking.status)}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-50 border-t flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition"
                    >
                        Cerrar
                    </button>
                    {booking.status === 'pending' && (
                        <button
                            onClick={onAccept}
                            disabled={isAccepting}
                            className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAccepting ? (
                                <><Loader2 size={18} className="animate-spin" /> Aceptando...</>
                            ) : (
                                <><CheckCircle size={18} /> Aceptar Reserva</>
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const ServiceCalendar: React.FC<ServiceCalendarProps> = ({ bookings, onBookingUpdate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);

    // Helper to get days in month
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 Sun, 1 Mon...

    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const startingDayOfWeek = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());

    const bookingsByDate = useMemo(() => {
        const map = new Map<string, ServiceBooking[]>();
        bookings.forEach(booking => {
            // Ensure strict string comparison YYYY-MM-DD
            const dateKey = booking.date;
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(booking);
        });
        return map;
    }, [bookings]);

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const getDayBookings = (date: Date) => {
        // Convert date to YYYY-MM-DD string using local time to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        return bookingsByDate.get(dateKey) || [];
    };

    const selectedDayBookings = getDayBookings(selectedDate);

    const getStatusColor = (status: ServiceBooking['status']) => {
        switch (status) {
            case 'confirmed': return 'bg-green-500';
            case 'pending': return 'bg-yellow-500';
            case 'cancelled': return 'bg-red-500';
            case 'completed': return 'bg-blue-500';
            default: return 'bg-gray-400';
        }
    };

    const getStatusBorder = (status: ServiceBooking['status']) => {
        switch (status) {
            case 'confirmed': return 'border-l-green-500';
            case 'pending': return 'border-l-yellow-500';
            case 'cancelled': return 'border-l-red-500';
            case 'completed': return 'border-l-blue-500';
            default: return 'border-l-gray-400';
        }
    };

    const getStatusLabel = (status: ServiceBooking['status']) => {
        switch (status) {
            case 'confirmed': return 'Confirmado';
            case 'pending': return 'Pendiente';
            case 'cancelled': return 'Cancelado';
            case 'completed': return 'Completado';
            case 'no_show': return 'No Show';
            default: return status;
        }
    };

    const handleAcceptBooking = async (bookingId: string) => {
        try {
            setIsAccepting(true);
            await api.put(`/bookings/${bookingId}/status`, { status: 'in_escrow' });
            setSelectedBooking(null);
            // Trigger refresh
            if (onBookingUpdate) {
                onBookingUpdate();
            }
        } catch (error) {
            toast.error('Error al aceptar la reserva. Por favor intenta de nuevo.');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleQuickAccept = async (e: React.MouseEvent, bookingId: string) => {
        e.stopPropagation();
        await handleAcceptBooking(bookingId);
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                {/* Left Column: Calendar View */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronLeft size={20} className="text-gray-600" />
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 capitalize">
                            {currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronRight size={20} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 mb-2">
                        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(day => (
                            <div key={day} className="text-center text-xs font-semibold text-gray-400 uppercase py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-24 bg-gray-50/50 rounded-lg"></div>
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                            const bookingsForDay = getDayBookings(date);
                            const isToday = isSameDay(date, new Date());
                            const isSelected = isSameDay(date, selectedDate);

                            return (
                                <motion.div
                                    key={day}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setSelectedDate(date)}
                                    className={`h-24 rounded-lg border p-2 cursor-pointer flex flex-col justify-between transition-all ${isSelected
                                        ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary'
                                        : 'border-gray-100 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${isToday ? 'bg-brand-primary text-white' : 'text-gray-700'
                                            }`}>
                                            {day}
                                        </span>
                                    </div>

                                    {/* Booking Indicators */}
                                    <div className="flex flex-wrap gap-1 content-end">
                                        {bookingsForDay.slice(0, 4).map((b, idx) => (
                                            <div
                                                key={idx}
                                                className={`w-2 h-2 rounded-full ${getStatusColor(b.status)}`}
                                                title={`${b.startTime} - ${b.serviceName}`}
                                            />
                                        ))}
                                        {bookingsForDay.length > 4 && (
                                            <span className="text-[10px] text-gray-400 leading-none">+</span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Day Agenda (Timeline) */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-full flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            <CalendarIcon size={18} className="mr-2 text-brand-secondary" />
                            Agenda del día
                        </h3>
                        <p className="text-brand-primary font-medium capitalize">
                            {selectedDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                        {selectedDayBookings.length > 0 ? (
                            selectedDayBookings
                                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                .map((booking) => (
                                    <motion.div
                                        key={booking.id}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${getStatusBorder(booking.status)} flex flex-col gap-2 group`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center text-gray-900 font-bold">
                                                <Clock size={14} className="mr-1 text-gray-400" />
                                                {booking.startTime} - {booking.endTime}
                                            </div>
                                            <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>

                                        <div>
                                            <h4 className="font-semibold text-gray-800 leading-tight">{booking.serviceName}</h4>
                                            <div className="flex items-center text-sm text-gray-500 mt-1">
                                                <User size={12} className="mr-1" /> {booking.customerName}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {getStatusLabel(booking.status)}
                                            </span>

                                            <div className="flex gap-2">
                                                {booking.status === 'pending' && (
                                                    <button
                                                        onClick={(e) => handleQuickAccept(e, booking.id)}
                                                        className="text-xs bg-brand-primary text-white px-2 py-1 rounded hover:bg-orange-600 transition-colors"
                                                    >
                                                        Aceptar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedBooking(booking)}
                                                    className="text-xs border border-gray-300 text-gray-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                                                >
                                                    Detalle
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-10">
                                <div className="bg-gray-200 p-4 rounded-full mb-3">
                                    <Clock size={32} className="text-gray-400" />
                                </div>
                                <p className="font-medium">Sin citas programadas</p>
                                <p className="text-sm">Disfruta de tu tiempo libre.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Booking Detail Modal */}
            <AnimatePresence>
                {selectedBooking && (
                    <BookingDetailModal
                        booking={selectedBooking}
                        onClose={() => setSelectedBooking(null)}
                        onAccept={() => handleAcceptBooking(selectedBooking.id)}
                        isAccepting={isAccepting}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default ServiceCalendar;
