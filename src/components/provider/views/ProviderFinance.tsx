
import React from 'react';
import { ProviderPayout, PayoutProviderStatus, ProviderTransaction } from '../../../types';
import { DollarSign, Banknote, TrendingUp, Download, Package, Wrench, Calendar, CheckCircle, Clock, XCircle, AlertTriangle, Lock } from 'lucide-react';

import { api } from '../../../api/client';

// NOTE: Payouts are currently mocked/empty from backend until Payouts system is built.
// Transactions are derived from Bookings.


const KpiCard: React.FC<{ title: string; value: string; icon: React.ElementType; subtext?: string; alert?: boolean }> = ({ title, value, icon: Icon, subtext, alert }) => (
    <div className={`bg-white p-5 rounded-lg shadow-sm border ${alert ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
        <div className="flex justify-between items-start">
            <h3 className={`font-semibold ${alert ? 'text-orange-800' : 'text-gray-800'}`}>{title}</h3>
            <div className={`p-2 rounded-md ${alert ? 'bg-orange-100' : 'bg-gray-100'}`}>
                <Icon className={`h-6 w-6 ${alert ? 'text-orange-600' : 'text-gray-600'}`} />
            </div>
        </div>
        <p className={`text-3xl font-bold mt-2 ${alert ? 'text-orange-900' : 'text-gray-900'}`}>{value}</p>
        {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
);

const StatusBadge: React.FC<{ status: PayoutProviderStatus }> = ({ status }) => {
    const styles = {
        [PayoutProviderStatus.PAID]: { icon: CheckCircle, style: 'bg-green-100 text-green-800' },
        [PayoutProviderStatus.IN_TRANSIT]: { icon: Clock, style: 'bg-blue-100 text-blue-800' },
        [PayoutProviderStatus.PENDING]: { icon: Clock, style: 'bg-yellow-100 text-yellow-800' },
        [PayoutProviderStatus.FAILED]: { icon: XCircle, style: 'bg-red-100 text-red-800' },
    };
    const config = styles[status] || styles[PayoutProviderStatus.PENDING];
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.style}`}>
            <Icon size={14} className="mr-1.5" />
            {status}
        </span>
    );
};

const LockedOverlay: React.FC<{ onVerify: () => void }> = ({ onVerify }) => (
    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 rounded-lg border border-gray-200">
        <div className="p-4 bg-orange-50 rounded-full mb-4">
            <Lock size={32} className="text-brand-primary" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Sección Restringida</h3>
        <p className="text-gray-600 mb-6 max-w-md">
            Para ver tus ingresos y gestionar pagos, necesitamos verificar tu identidad.
        </p>
        <button
            onClick={onVerify}
            className="bg-brand-primary text-white font-semibold py-2 px-6 rounded-full hover:bg-orange-600 transition-colors shadow-lg"
        >
            Completar Verificación
        </button>
    </div>
);

const ProviderFinance: React.FC = () => {
    const [kpi, setKpi] = React.useState({
        availableBalance: 0,
        totalIncome: 0,
        commissionPaid: 0,
        nextPayout: 0
    });
    const [payouts, setPayouts] = React.useState<ProviderPayout[]>([]);
    const [transactions, setTransactions] = React.useState<ProviderTransaction[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isLocked, setIsLocked] = React.useState(false); // New State

    // Note: Removed require() call that caused "require is not defined" error in browser

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    React.useEffect(() => {
        const fetchFinance = async () => {
            try {
                const response = await api.get('/provider/finance');
                if (response.data.status === 'success') {
                    setKpi(response.data.kpi);
                    setPayouts(response.data.payouts);
                    setTransactions(response.data.transactions);
                }
            } catch (error: any) {
                console.error("Error fetching finance details", error);
                // Check if it's our KYC error
                if (error.response && error.response.status === 403 && error.response.data?.code === 'KYC_REQUIRED') {
                    setIsLocked(true);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchFinance();
    }, []);

    const handleUnlock = () => {
        // This re-triggers the global modal via the store if available, or navigates
        // Since we can't easily hook into store without import at top, let's use the event or just navigate
        // Better: Use the store hook if we imported it. 
        // Let's assume user clicks button -> Modal opens (via store import we'll add) or redirect.
        // For now, let's just use window location as fallback or better yet, import store at top.
        window.location.href = '/provider/dashboard?view=profile';
    };

    if (isLocked) {
        return (
            <div className="relative min-h-[600px]">
                <LockedOverlay onVerify={handleUnlock} />
                {/* Blur everything behind */}
                <div className="filter blur-sm pointer-events-none select-none opacity-50">
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800">Finanzas</h1>
                                <p className="mt-1 text-gray-600">Revisa tus ingresos, gestiona tus pagos y descarga reportes.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <KpiCard title="Monto a pagar mañana" value="$0" icon={Banknote} />
                            <KpiCard title="Monto total a pagar en el futuro de servicios contratados a la fecha" value="$0" icon={Calendar} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Finanzas</h1>
                    <p className="mt-1 text-gray-600">Revisa tus ingresos, gestiona tus pagos y descarga reportes.</p>
                </div>
                {!isLocked && (
                    <div className="flex gap-2">
                        <button className="flex items-center justify-center gap-2 w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-md transition-colors duration-300">
                            <Download size={18} />
                            <span>Descargar Reporte</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <KpiCard title="Monto a pagar mañana" value={loading ? '...' : formatCurrency(kpi.availableBalance)} icon={Banknote} />
                <KpiCard title="Monto total a pagar en el futuro de servicios contratados a la fecha" value={loading ? '...' : formatCurrency(kpi.nextPayout)} icon={Calendar} />
            </div>

            {/* Historial de Pagos (Payouts) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="text-lg font-semibold text-gray-800">Historial de Pagos</h3></div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto Bruto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retención SII</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto Neto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {payouts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-4 text-gray-500">No hay pagos registrados aún.</td>
                                </tr>
                            )}
                            {payouts.map(p => (
                                <tr key={p.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(p.date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatCurrency(p.grossAmount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">-{formatCurrency(p.commission)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                        {p.siiRetention > 0 ? `-${formatCurrency(p.siiRetention)}` : '-'}
                                        {/* FIX: The `title` prop is not supported on lucide-react icons. Wrapped the icon in a `span` with a title to show the tooltip. */}
                                        {p.siiRetention > 0 && <span title="Retención aplicada por no tener inicio de actividades en el SII."><AlertTriangle className="inline ml-2 h-4 w-4 text-yellow-500" /></span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{formatCurrency(p.netAmount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transacciones Recientes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="text-lg font-semibold text-gray-800">Transacciones Recientes</h3></div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tu Ganancia</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center py-4 text-gray-500">{loading ? 'Cargando...' : 'No hay transacciones recientes.'}</td>
                                </tr>
                            )}
                            {transactions.map(t => (
                                <tr key={t.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.date).toLocaleString('es-CL')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{formatCurrency(t.yourEarning)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProviderFinance;
