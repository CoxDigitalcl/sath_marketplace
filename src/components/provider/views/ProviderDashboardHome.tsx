import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Package, Calendar, Star, Package as PackageIcon, Calendar as CalendarIcon, X, ArrowRight } from 'lucide-react';
import { ServiceBooking, RecentActivity } from '../../../types';
import ServiceCalendar from '../services/ServiceCalendar';
import { api } from '../../../api/client';
import DashboardBanner from '../DashboardBanner';
import ActivationChecklist from '../ActivationChecklist';

// Expanded KPI Data format
interface KpiData {
    income: {
        totalSales: number;
        ordersCount: number;
        commissionPaid: number;
        pendingPayout: number;
    };
    assets: {
        activeServices: number;
        activeProducts: number;
        lowStock: number;
    };
    reputation: {
        avgRating: number;
        pendingReviews: number;
    };
    onboarding?: {
        isVerified: boolean;
        hasServices: boolean;
        hasKycDocs: boolean;
        hasBankDetails: boolean;
    };
}

const initialKpiData: KpiData = {
    income: { totalSales: 0, ordersCount: 0, commissionPaid: 0, pendingPayout: 0 },
    assets: { activeServices: 0, activeProducts: 0, lowStock: 0 },
    reputation: { avgRating: 0, pendingReviews: 0 },
    onboarding: undefined
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

const KpiCard: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; alert?: boolean; footerAction?: () => void; footerText?: string }> = ({ title, icon: Icon, children, alert, footerAction, footerText }) => (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <div className={`p-2 rounded-md ${alert ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Icon className={`h-6 w-6 ${alert ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
        </div>
        <div className="flex-grow">
            {children}
        </div>
        {footerAction && (
            <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                    onClick={footerAction}
                    className="text-sm font-medium text-brand-primary hover:text-orange-700 flex items-center transition-colors w-full justify-center"
                >
                    {footerText || 'Ver más'} <ArrowRight size={14} className="ml-1" />
                </button>
            </div>
        )}
    </div>
);

interface ProviderDashboardHomeProps {
    navigateTo?: (view: string) => void;
}

const ProviderDashboardHome: React.FC<ProviderDashboardHomeProps> = ({ navigateTo }) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [kpiData, setKpiData] = useState<KpiData>(initialKpiData);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [allBookings, setAllBookings] = useState<ServiceBooking[]>([]);
    const [todaysBookings, setTodaysBookings] = useState<ServiceBooking[]>([]);
    const [upcomingBookings, setUpcomingBookings] = useState<ServiceBooking[]>([]);
    const [loading, setLoading] = useState(true);

    // Map raw status to ServiceBooking status type
    const mapBookingStatus = (rawStatus: string): ServiceBooking['status'] => {
        switch (rawStatus) {
            case 'pending_payment': return 'pending';
            case 'in_escrow': return 'confirmed';
            case 'service_completed': return 'completed';
            case 'released': return 'completed';
            case 'cancelled': return 'cancelled';
            case 'disputed': return 'pending';
            default: return 'pending';
        }
    };

    const fetchData = React.useCallback(async () => {
        try {
            // Fetch dashboard stats and bookings in parallel
            const [statsResponse, bookingsResponse] = await Promise.all([
                api.get('/provider/dashboard-stats'),
                api.get('/bookings')
            ]);

            if (statsResponse.data.status === 'success') {
                setKpiData(statsResponse.data.stats);
                setRecentActivity(statsResponse.data.recentActivity);
            }

            if (bookingsResponse.data.status === 'success') {
                const bookings = bookingsResponse.data.bookings || [];

                // Transform to ServiceBooking format
                const transformedBookings: ServiceBooking[] = bookings
                    .filter((b: any) => b.scheduled_date) // Only bookings with scheduled date
                    .map((b: any) => {
                        const scheduledDate = new Date(b.scheduled_date);
                        const dateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
                        // Default time if not specified
                        const startTime = scheduledDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
                        // Assume 1 hour duration
                        const endDate = new Date(scheduledDate.getTime() + 60 * 60 * 1000);
                        const endTime = endDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });

                        return {
                            id: b.id,
                            service_id: b.id, // Using booking ID as we don't have service_id in response
                            customerName: b.customer_name || 'Cliente',
                            serviceName: b.item_name || 'Servicio',
                            date: dateStr,
                            startTime,
                            endTime,
                            status: mapBookingStatus(b.raw_status)
                        };
                    });

                setAllBookings(transformedBookings);

                // Filter for today's bookings
                const today = new Date().toISOString().split('T')[0];
                const todays = transformedBookings.filter(b => b.date === today);
                setTodaysBookings(todays);

                const futureBookings = transformedBookings.filter(b => b.date > today);
                futureBookings.sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return a.startTime.localeCompare(b.startTime);
                });
                setUpcomingBookings(futureBookings.slice(0, 3));
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando datos del panel...</div>;

    const getStatusBadge = (status: string) => { // relaxed type
        const styles: Record<string, string> = {
            'Confirmado': 'bg-blue-100 text-blue-800',
            'Pendiente': 'bg-yellow-100 text-yellow-800',
            'Entregado': 'bg-green-100 text-green-800',
            'Cancelado': 'bg-red-100 text-red-800',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
    };

    // Determine if account is active or needs onboarding
    const isAccountActive = kpiData.onboarding?.isVerified;

    return (
        <div className="space-y-6">

            {/* Banner for Inactive Accounts */}
            {!isAccountActive && <DashboardBanner />}

            {/* KPIs and Conditional Sections Container */}
            <div className="flex flex-col-reverse lg:flex-col gap-6">

                {/* Conditional Rendering: Activation Checklist OR Recent Activity */}
                {!isAccountActive && kpiData.onboarding ? (
                    <div className="order-last lg:order-none">
                        <ActivationChecklist
                            status={kpiData.onboarding}
                            navigateTo={navigateTo || (() => { })}
                        />
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 order-last lg:order-none">
                        <div className="p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-800">Actividad Reciente</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {recentActivity.length > 0 ? recentActivity.map(activity => (
                                        <tr key={activity.id}>
                                            <td className="px-4 py-4"><span className="text-gray-500">{activity.type === 'service' ? <CalendarIcon size={20} /> : <PackageIcon size={20} />}</span></td>
                                            <td className="px-4 py-4 font-medium text-gray-800">{activity.item}</td>
                                            <td className="px-4 py-4 text-sm text-gray-600">{activity.customerEmail}</td>
                                            <td className="px-4 py-4 text-sm text-gray-500">{new Date(activity.date).toLocaleString('es-CL')}</td>
                                            <td className="px-4 py-4 text-sm font-semibold text-gray-800">{formatCurrency(activity.amount)}</td>
                                            <td className="px-4 py-4">{getStatusBadge(activity.status)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                                                No hay actividad reciente.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KpiCard title="Ingresos del Mes" icon={DollarSign}>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Total Ventas</span><span className="font-medium text-gray-800">{formatCurrency(kpiData.income.totalSales)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Comisión Pagada</span><span className="font-medium text-gray-800">{formatCurrency(kpiData.income.commissionPaid)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Pendiente de Payout</span><span className="font-bold text-green-600">{formatCurrency(kpiData.income.pendingPayout)}</span></div>
                        </div>
                    </KpiCard>
                    <KpiCard title="Servicios/Productos" icon={Package} alert={kpiData.assets.lowStock > 0}>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Servicios Activos</span><span className="font-medium text-gray-800">{kpiData.assets.activeServices}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Productos Activos</span><span className="font-medium text-gray-800">{kpiData.assets.activeProducts}</span></div>
                            {kpiData.assets.lowStock > 0 && <div className="flex justify-between text-red-600"><span className="font-bold">Bajo Stock</span><span className="font-bold">{kpiData.assets.lowStock}</span></div>}
                        </div>
                    </KpiCard>
                    <KpiCard
                        title="Próximos eventos"
                        icon={Calendar}
                        footerAction={() => setIsCalendarOpen(true)}
                        footerText="Ver Agenda Completa"
                    >
                        <ul className="space-y-2 text-sm">
                            {todaysBookings.length > 0 ? (
                                todaysBookings.map(b => (
                                    <li key={b.id} className="flex items-center">
                                        <span className="font-bold text-brand-secondary w-14 flex-shrink-0">{b.startTime}</span>
                                        <span className="text-gray-600 truncate" title={b.serviceName}>{b.serviceName}</span>
                                    </li>
                                ))
                            ) : upcomingBookings.length > 0 ? (
                                upcomingBookings.map(b => {
                                    const dateParts = b.date.split('-');
                                    const displayDate = `${dateParts[2]}/${dateParts[1]}`;
                                    return (
                                        <li key={b.id} className="flex items-center justify-between">
                                            <div className="flex items-center overflow-hidden">
                                                <span className="font-bold text-brand-secondary w-14 flex-shrink-0">{b.startTime}</span>
                                                <span className="text-gray-600 truncate" title={b.serviceName}>{b.serviceName}</span>
                                            </div>
                                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{displayDate}</span>
                                        </li>
                                    );
                                })
                            ) : (
                                <li className="text-gray-500 italic">No hay citas para hoy ni eventos próximos.</li>
                            )}
                        </ul>
                    </KpiCard>
                    <KpiCard title="Reputación" icon={Star}>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center"><span className="text-gray-500">Rating Promedio</span><span className="font-bold text-2xl text-gray-800 flex items-center">{kpiData.reputation.avgRating} <Star size={20} className="ml-1 text-yellow-400 fill-current" /></span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Reseñas Pendientes</span><span className="font-medium text-gray-800">{kpiData.reputation.pendingReviews}</span></div>
                        </div>
                    </KpiCard>
                </div>
            </div>

            {/* Calendar Modal */}
            <AnimatePresence>
                {isCalendarOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsCalendarOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden relative max-h-[90vh] overflow-y-auto"
                        >
                            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                                <h2 className="text-xl font-bold text-gray-800">Agenda Completa</h2>
                                <button
                                    onClick={() => setIsCalendarOpen(false)}
                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X size={24} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="p-6">
                                <ServiceCalendar bookings={allBookings} onBookingUpdate={fetchData} />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default ProviderDashboardHome;
