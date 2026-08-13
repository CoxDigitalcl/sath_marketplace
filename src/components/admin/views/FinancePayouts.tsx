import React, { useState, useMemo, useEffect } from 'react';
import { PayoutFailure, SIIReport, SIIReportStatus, Order, PayoutStatus } from '../../../types';
import TransactionStatusBadge from '../transaction-engine/TransactionStatusBadge';
import { Download, AlertCircle, Banknote, Calendar, BarChart2, AlertTriangle, Repeat, CheckSquare, FileText, Settings, ExternalLink } from 'lucide-react';

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




// Mock data removed.
type FinanceTab = 'failed_payouts' | 'sii_reports' | 'settlements';

const KpiCard: React.FC<{ title: string; mainValue: string; subValues?: { label: string, value: string }[]; icon: React.ElementType; alert?: boolean }> = ({ title, mainValue, subValues, icon: Icon, alert }) => (
    <div className={`bg-white p-5 rounded-lg shadow-sm border ${alert ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
        <div className="flex justify-between items-start">
            <h3 className={`text-md font-semibold ${alert ? 'text-red-800' : 'text-gray-800'}`}>{title}</h3>
            <div className={`p-2 rounded-md ${alert ? 'bg-red-200' : 'bg-gray-100'}`}>
                <Icon className={`h-6 w-6 ${alert ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
        </div>
        <p className={`text-3xl font-bold mt-2 ${alert ? 'text-red-900' : 'text-gray-900'}`}>{mainValue}</p>
        {subValues && (
            <div className="mt-3 space-y-1 text-sm">
                {subValues.map(sv => (
                    <div key={sv.label} className="flex justify-between">
                        <span className={`${alert ? 'text-red-700' : 'text-gray-500'}`}>{sv.label}</span>
                        <span className={`font-medium ${alert ? 'text-red-800' : 'text-gray-700'}`}>{sv.value}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);


const FinancePayouts: React.FC = () => {
    const [activeTab, setActiveTab] = useState<FinanceTab>('failed_payouts');
    const [orders, setOrders] = useState<Order[]>([]);

    // Fetch real orders to calculate payouts
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                // Removed Auth header as per direct access change
                const response = await adminFetch('/api/admin/transactions');
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        setOrders(data.data);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch orders for finance view", err);
            }
        };
        fetchOrders();
    }, []);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

    // Derived Tables
    const pendingPayouts = useMemo(() => {
        return orders.filter(o => o.payout_status === PayoutStatus.PAYKU_SCHEDULED);
    }, [orders]);

    const payoutFailures = useMemo(() => {
        // Derive failed payouts from orders with failed status
        return orders.filter(o => o.payout_status === PayoutStatus.PAYKU_FAILED).map(o => ({
            id: o.id,
            provider_id: o.provider_id,
            provider_name: o.provider_name,
            amount_clp: o.provider_payout_clp,
            reason: 'Error en Payku (Verificar Logs)', // Generic reason since DB doesn't store specifics yet
            payku_transaction_id: o.payku_transaction_id || '',
            failed_at: o.updated_at || new Date().toISOString(),
            resolved: false
        }));
    }, [orders]);

    // Derived KPIs
    const kpiData = useMemo(() => {
        const totalBalance = orders
            .filter(o => o.status === 'AUTHORIZED' || o.payout_status === 'PAYKU_SCHEDULED')
            .reduce((sum, o) => sum + o.total_clp, 0);

        const scheduledPayouts = pendingPayouts.reduce((sum, o) => sum + o.provider_payout_clp, 0);

        const totalCommissions = orders
            .filter(o => o.status === 'COMPLETED')
            .reduce((sum, o) => sum + o.platform_commission_clp, 0);

        const totalSii = orders.reduce((sum, o) => sum + (o.sii_retention_clp || 0), 0);

        const failedCount = payoutFailures.length;
        const failedTotal = payoutFailures.reduce((sum, f) => sum + f.amount_clp, 0);

        return {
            balance: { total: totalBalance, scheduled: scheduledPayouts, retentions: totalSii },
            commissions: { total: totalCommissions, average: 0, growth: 0 }, // Growth/Avg requires historical comparison logic
            sii: { total: totalSii, providers: 0 },
            failedPayouts: { count: failedCount, total: failedTotal }
        };
    }, [orders, pendingPayouts, payoutFailures]);


    const renderTabContent = () => {
        switch (activeTab) {
            case 'failed_payouts':
                return (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50"><tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Razón (Payku)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Fallo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                            </tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {payoutFailures.length > 0 ? payoutFailures.map(p => (
                                    <tr key={p.id} className={!p.resolved ? 'bg-red-50' : ''}>
                                        <td className="px-4 py-4 font-medium text-gray-800">{p.provider_name}</td>
                                        <td className="px-4 py-4 font-bold text-gray-900">{formatCurrency(p.amount_clp)}</td>
                                        <td className="px-4 py-4 text-sm text-gray-600">{p.reason}</td>
                                        <td className="px-4 py-4 text-sm text-gray-500">{new Date(p.failed_at).toLocaleString('es-CL')}</td>
                                        <td className="px-4 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.resolved ? 'Resuelto' : 'Pendiente'}</span></td>
                                        <td className="px-4 py-4"><div className="flex gap-2">{!p.resolved && <>
                                            <button className="flex items-center text-sm font-medium bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700"><Repeat size={14} className="mr-1" /> Reintentar</button>
                                            <button className="flex items-center text-sm font-medium bg-gray-200 text-gray-800 py-1 px-3 rounded-md hover:bg-gray-300"><CheckSquare size={14} className="mr-1" /> Marcar Resuelto</button>
                                        </>}</div></td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay pagos fallidos registrados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                );
            case 'sii_reports':
                return (
                    <div className="p-5 space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-md border">
                            <h4 className="font-semibold">Generar Nuevo Reporte</h4>
                            <input type="month" defaultValue="2025-07" className="border-gray-300 rounded-md shadow-sm" />
                            <button className="flex items-center text-sm font-medium bg-brand-primary text-white py-2 px-4 rounded-md hover:opacity-90"><FileText size={16} className="mr-2" /> Generar XML (Demo)</button>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Historial de Reportes</h4>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50"><tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto Retenido</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                                    </tr></thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No hay reportes generados.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'settlements':
                return (
                    <div className="p-5 space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-md border">
                            <h4 className="font-semibold">Descargar Liquidaciones</h4>
                            <div className="flex items-center gap-2">
                                <label htmlFor="from">Desde:</label><input type="date" id="from" defaultValue="2025-07-01" className="border-gray-300 rounded-md shadow-sm" />
                                <label htmlFor="to">Hasta:</label><input type="date" id="to" defaultValue="2025-07-31" className="border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <button className="flex items-center text-sm font-medium bg-brand-primary text-white py-2 px-4 rounded-md hover:opacity-90"><Download size={16} className="mr-2" /> Descargar CSV (Demo)</button>
                        </div>
                        <div className="text-center text-gray-500 p-8">
                            <p>No hay historial de settlements disponible.</p>
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Finanzas & Payouts</h1>
                <p className="mt-1 text-gray-600">Controla el flujo de dinero, comisiones, retenciones y pagos a proveedores.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Saldo en Payku" mainValue={formatCurrency(kpiData.balance.total)} icon={Banknote} subValues={[
                    { label: 'Payouts Programados', value: formatCurrency(kpiData.balance.scheduled) },
                    { label: 'Retenciones SII', value: formatCurrency(kpiData.balance.retentions) }
                ]} />
                <KpiCard title="Comisiones Ganadas (30d)" mainValue={formatCurrency(kpiData.commissions.total)} icon={BarChart2} subValues={[
                    { label: 'Promedio Diario', value: formatCurrency(kpiData.commissions.average) },
                    { label: 'vs Mes Anterior', value: `${(kpiData.commissions.growth * 100).toFixed(0)}%` }
                ]} />
                <KpiCard title="Retenciones SII (Pendientes)" mainValue={formatCurrency(kpiData.sii.total)} icon={FileText} alert={kpiData.sii.total > 10000} subValues={[
                    { label: 'Proveedores Afectados', value: kpiData.sii.providers.toString() }
                ]} />
                <KpiCard title="Payouts Fallidos (7d)" mainValue={kpiData.failedPayouts.count.toString()} icon={AlertTriangle} alert={kpiData.failedPayouts.count > 0} subValues={[
                    { label: 'Monto Total', value: formatCurrency(kpiData.failedPayouts.total) }
                ]} />
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Órdenes Pendientes de Payout ({pendingPayouts.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50"><tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto Payout</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">{pendingPayouts.map(order => (
                            <tr key={order.id}>
                                <td className="px-4 py-4 font-mono text-sm text-gray-600">{order.order_number}</td>
                                <td className="px-4 py-4 text-sm text-gray-800">{order.provider_name}</td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-900">{formatCurrency(order.provider_payout_clp)}</td>
                                <td className="px-4 py-4"><TransactionStatusBadge status={order.payout_status} type="payout" /></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 px-4">
                        <button onClick={() => setActiveTab('failed_payouts')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'failed_payouts' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><AlertTriangle size={16} className="mr-2" />Payouts Fallidos</button>
                        <button onClick={() => setActiveTab('sii_reports')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'sii_reports' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><FileText size={16} className="mr-2" />Reportes SII</button>
                        <button onClick={() => setActiveTab('settlements')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settlements' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Download size={16} className="mr-2" />Settlements Payku</button>
                    </nav>
                </div>
                {renderTabContent()}
            </div>

        </div>
    );
};

export default FinancePayouts;