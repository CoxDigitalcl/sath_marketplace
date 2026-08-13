
import React from 'react';
import { motion } from 'framer-motion';
import {
    ArrowUp, ArrowDown, DollarSign, ShoppingCart, Users, AlertTriangle,
    FileCheck, Ticket, TrendingUp, BarChart3, PieChart as PieChartIcon, Activity
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Helper: Authenticated fetch for admin endpoints
const adminFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
};




// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// ── Design Tokens ──────────────────────────────────────────────────────────────
const CHART_COLORS = {
    primary: 'rgba(99, 102, 241, 1)',        // Indigo
    primaryFaded: 'rgba(99, 102, 241, 0.15)',
    secondary: 'rgba(16, 185, 129, 1)',      // Emerald
    secondaryFaded: 'rgba(16, 185, 129, 0.15)',
    accent: 'rgba(245, 158, 11, 1)',         // Amber
    accentFaded: 'rgba(245, 158, 11, 0.15)',
    pink: 'rgba(236, 72, 153, 1)',           // Pink
    pinkFaded: 'rgba(236, 72, 153, 0.15)',
    cyan: 'rgba(6, 182, 212, 1)',
    purple: 'rgba(139, 92, 246, 1)',
    // Doughnut palette
    doughnut: [
        'rgba(99, 102, 241, 0.85)',
        'rgba(16, 185, 129, 0.85)',
        'rgba(245, 158, 11, 0.85)',
        'rgba(236, 72, 153, 0.85)',
        'rgba(6, 182, 212, 0.85)',
        'rgba(139, 92, 246, 0.85)',
        'rgba(107, 114, 128, 0.85)',
    ],
};

const STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Pendiente Pago',
    in_escrow: 'En Escrow',
    confirmed: 'Confirmada',
    completed: 'Completada',
    service_completed: 'Servicio Completado',
    released: 'Liberada',
    cancelled: 'Cancelada',
    disputed: 'Disputada',
};

const formatCLP = (v: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);

// ── KPI Card ───────────────────────────────────────────────────────────────────
interface KpiCardProps {
    title: string;
    value: string;
    change: number;
    icon: React.ElementType;
    color?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, change, icon: Icon, color = 'bg-indigo-500' }) => {
    const isPositive = change >= 0;
    const TrendIcon = isPositive ? ArrowUp : ArrowDown;

    return (
        <motion.div
            whileHover={{ translateY: -4, boxShadow: '0 12px 24px -4px rgba(0,0,0,0.1)' }}
            transition={{ duration: 0.2 }}
            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden"
        >
            {/* Decorative gradient bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${color}`} />

            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${color} bg-opacity-10`}>
                    <Icon className="h-5 w-5 text-gray-600" />
                </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
                <span className={`flex items-center font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                    <TrendIcon size={14} className="mr-1" /> {Math.abs(change)}%
                </span>
                <span className="text-gray-400 ml-2">vs mes anterior</span>
            </div>
        </motion.div>
    );
};

// ── Shared Chart Options ───────────────────────────────────────────────────────
const baseLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
        legend: {
            position: 'top' as const,
            labels: {
                usePointStyle: true,
                pointStyle: 'circle' as const,
                padding: 20,
                font: { size: 12, family: "'Inter', sans-serif" },
            },
        },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 12,
            titleFont: { size: 13, family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            cornerRadius: 8,
            displayColors: true,
        },
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: {
                font: { size: 12, family: "'Inter', sans-serif" },
                color: '#94a3b8',
            },
        },
        y: {
            grid: { color: 'rgba(241, 245, 249, 1)', drawBorder: false },
            ticks: {
                font: { size: 11, family: "'Inter', sans-serif" },
                color: '#94a3b8',
            },
            beginAtZero: true,
        },
    },
};

// ── Chart Data Types ───────────────────────────────────────────────────────────
interface ChartDataState {
    revenueByMonth: Array<{ month: string; label: string; revenue: number; bookings: number }>;
    userGrowth: Array<{ month: string; label: string; clients: number; providers: number; total: number }>;
    bookingsByStatus: Array<{ status: string; count: number }>;
    topServices: Array<{ title: string; bookings: number; revenue: number }>;
}

// ── Dashboard Home ─────────────────────────────────────────────────────────────
interface DashboardHomeProps {
    setActiveView?: (view: any) => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ setActiveView }) => {
    const [stats, setStats] = React.useState({
        totalUsers: 0,
        totalProviders: 0,
        totalBookings: 0,
        totalRevenue: 0
    });
    const [chartData, setChartData] = React.useState<ChartDataState | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [chartsLoading, setChartsLoading] = React.useState(true);

    // Fetch KPI stats
    React.useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = JSON.parse(sessionStorage.getItem('auth-storage') || '{}').state?.token;

                const response = await adminFetch('/api/admin/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        setStats(data.data);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch admin stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Fetch Chart data
    React.useEffect(() => {
        const fetchCharts = async () => {
            try {
                const token = JSON.parse(sessionStorage.getItem('auth-storage') || '{}').state?.token;

                const response = await adminFetch('/api/admin/dashboard-charts', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        setChartData(data.data);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch chart data", error);
            } finally {
                setChartsLoading(false);
            }
        };

        fetchCharts();
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3" />
                <span className="text-gray-500 font-medium">Cargando estadísticas...</span>
            </div>
        );
    }

    // ── Build chart datasets ───────────────────────────────────────────────────
    const revenueLabels = chartData?.revenueByMonth.map(r => r.label) || [];
    const revenueChartData = {
        labels: revenueLabels,
        datasets: [
            {
                label: 'Ingresos (CLP)',
                data: chartData?.revenueByMonth.map(r => r.revenue) || [],
                borderColor: CHART_COLORS.primary,
                backgroundColor: CHART_COLORS.primaryFaded,
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: CHART_COLORS.primary,
                pointBorderWidth: 2,
                pointHoverRadius: 6,
            },
            {
                label: 'Reservas',
                data: chartData?.revenueByMonth.map(r => r.bookings) || [],
                borderColor: CHART_COLORS.secondary,
                backgroundColor: CHART_COLORS.secondaryFaded,
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: CHART_COLORS.secondary,
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                yAxisID: 'y1',
            },
        ],
    };

    const revenueOptions = {
        ...baseLineOptions,
        plugins: {
            ...baseLineOptions.plugins,
            tooltip: {
                ...baseLineOptions.plugins.tooltip,
                callbacks: {
                    label: (ctx: any) => {
                        if (ctx.datasetIndex === 0) return `Ingresos: ${formatCLP(ctx.parsed.y)}`;
                        return `Reservas: ${ctx.parsed.y}`;
                    },
                },
            },
        },
        scales: {
            ...baseLineOptions.scales,
            y: {
                ...baseLineOptions.scales.y,
                position: 'left' as const,
                ticks: {
                    ...baseLineOptions.scales.y.ticks,
                    callback: (v: any) => formatCLP(v),
                },
            },
            y1: {
                position: 'right' as const,
                grid: { drawOnChartArea: false },
                beginAtZero: true,
                ticks: {
                    font: { size: 11, family: "'Inter', sans-serif" },
                    color: '#94a3b8',
                },
            },
        },
    };

    // User Growth Bar Chart
    const userGrowthData = {
        labels: chartData?.userGrowth.map(u => u.label) || [],
        datasets: [
            {
                label: 'Clientes',
                data: chartData?.userGrowth.map(u => u.clients) || [],
                backgroundColor: CHART_COLORS.primary,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.6,
            },
            {
                label: 'Proveedores',
                data: chartData?.userGrowth.map(u => u.providers) || [],
                backgroundColor: CHART_COLORS.accent,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.6,
            },
        ],
    };

    const barOptions = {
        ...baseLineOptions,
        plugins: {
            ...baseLineOptions.plugins,
        },
    };

    // Booking Status Doughnut
    const statusLabels = chartData?.bookingsByStatus.map(s => STATUS_LABELS[s.status] || s.status) || [];
    const statusCounts = chartData?.bookingsByStatus.map(s => s.count) || [];

    const doughnutData = {
        labels: statusLabels,
        datasets: [
            {
                data: statusCounts,
                backgroundColor: CHART_COLORS.doughnut.slice(0, statusLabels.length),
                borderWidth: 0,
                hoverOffset: 8,
            },
        ],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle' as const,
                    padding: 16,
                    font: { size: 11, family: "'Inter', sans-serif" },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx: any) => {
                        const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                        return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                    },
                },
            },
        },
    };

    // Top Services horizontal bar
    const topServicesData = {
        labels: chartData?.topServices.map(s => s.title.length > 25 ? s.title.slice(0, 25) + '…' : s.title) || [],
        datasets: [
            {
                label: 'Reservas',
                data: chartData?.topServices.map(s => s.bookings) || [],
                backgroundColor: CHART_COLORS.primary,
                borderRadius: 6,
                barPercentage: 0.7,
            },
        ],
    };

    const topServicesOptions = {
        ...baseLineOptions,
        indexAxis: 'y' as const,
        plugins: {
            ...baseLineOptions.plugins,
            legend: { display: false },
        },
    };

    const hasChartData = chartData && (
        chartData.revenueByMonth.length > 0 ||
        chartData.userGrowth.length > 0 ||
        chartData.bookingsByStatus.length > 0
    );

    const ChartPlaceholder = ({ icon: PlIcon, text }: { icon: React.ElementType; text: string }) => (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <PlIcon size={36} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">{text}</p>
            <p className="text-xs mt-1">Los datos aparecerán cuando haya actividad.</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <KpiCard title="Ingresos Totales" value={formatCLP(stats.totalRevenue)} change={0} icon={DollarSign} color="bg-indigo-500" />
                <KpiCard title="Reservas Totales" value={stats.totalBookings.toString()} change={0} icon={ShoppingCart} color="bg-emerald-500" />
                <KpiCard title="Usuarios Totales" value={stats.totalUsers.toString()} change={0} icon={Users} color="bg-amber-500" />
                <KpiCard title="Proveedores" value={stats.totalProviders.toString()} change={0} icon={Users} color="bg-pink-500" />
            </div>

            {/* Charts Section */}
            {chartsLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${i === 1 ? 'lg:col-span-2' : ''}`}>
                            <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
                                <div className="h-64 bg-gray-100 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {/* Row 1: Revenue Line + Booking Status Doughnut */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={18} className="text-indigo-500" />
                                    <h3 className="text-lg font-semibold text-gray-800">Visión General de Ingresos</h3>
                                </div>
                                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Últimos 6 meses</span>
                            </div>
                            <div className="h-72">
                                {hasChartData && chartData!.revenueByMonth.length > 0 ? (
                                    <Line data={revenueChartData} options={revenueOptions as any} />
                                ) : (
                                    <ChartPlaceholder icon={TrendingUp} text="Sin datos de ingresos" />
                                )}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <PieChartIcon size={18} className="text-emerald-500" />
                                <h3 className="text-lg font-semibold text-gray-800">Estado de Reservas</h3>
                            </div>
                            <div className="h-72">
                                {hasChartData && chartData!.bookingsByStatus.length > 0 ? (
                                    <Doughnut data={doughnutData} options={doughnutOptions as any} />
                                ) : (
                                    <ChartPlaceholder icon={PieChartIcon} text="Sin reservas registradas" />
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Row 2: User Growth + Top Services + Quick Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 size={18} className="text-amber-500" />
                                <h3 className="text-lg font-semibold text-gray-800">Crecimiento de Usuarios</h3>
                            </div>
                            <div className="h-64">
                                {hasChartData && chartData!.userGrowth.length > 0 ? (
                                    <Bar data={userGrowthData} options={barOptions as any} />
                                ) : (
                                    <ChartPlaceholder icon={Users} text="Sin datos de usuarios" />
                                )}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Activity size={18} className="text-purple-500" />
                                <h3 className="text-lg font-semibold text-gray-800">Top Servicios</h3>
                            </div>
                            <div className="h-64">
                                {hasChartData && chartData!.topServices.length > 0 ? (
                                    <Bar data={topServicesData} options={topServicesOptions as any} />
                                ) : (
                                    <ChartPlaceholder icon={BarChart3} text="Sin servicios reservados" />
                                )}
                            </div>
                        </motion.div>

                        {/* Quick Actions & Alerts */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="space-y-5"
                        >
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                                    <AlertTriangle className="text-yellow-500 mr-2" size={18} />
                                    Alertas Críticas
                                </h3>
                                <div className="mt-4 text-sm text-gray-500">
                                    <p>No hay alertas críticas pendientes.</p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800">Atajos Rápidos</h3>
                                <ul className="mt-4 space-y-3 text-sm">
                                    <li>
                                        <button onClick={() => setActiveView && setActiveView('providers')} className="flex items-center text-gray-700 hover:text-indigo-600 w-full justify-between focus:outline-none transition-colors">
                                            <div className="flex items-center"><FileCheck size={16} className="mr-2" />Aprobar Proveedores</div>
                                            <span className="font-bold text-gray-400">→</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button onClick={() => setActiveView && setActiveView('tickets')} className="flex items-center text-gray-700 hover:text-indigo-600 w-full justify-between focus:outline-none transition-colors">
                                            <div className="flex items-center"><Ticket size={16} className="mr-2" />Tickets Críticos</div>
                                            <span className="font-bold text-gray-400">→</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DashboardHome;
