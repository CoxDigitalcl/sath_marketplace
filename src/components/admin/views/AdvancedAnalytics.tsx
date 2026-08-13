
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {


    Banknote, BarChart2, AlertTriangle, Users, FileText, ShoppingCart,
    ShieldCheck, UserCheck, Percent, Clock, FileWarning, Shield, UserX,
    ArrowUp, ArrowDown, Download
} from 'lucide-react';

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


interface KpiCardProps {
    kpi: {
        id: string;
        title: string;
        value: string;
        trend: number;
        icon: React.ElementType;
        alert: boolean;
        isV2?: boolean;
    };
}

const KpiCard: React.FC<KpiCardProps> = ({ kpi }) => {
    const TrendIcon = kpi.trend >= 0 ? ArrowUp : ArrowDown;
    const trendColor = kpi.trend >= 0 ? 'text-green-600' : 'text-red-600';

    return (
        <div className={`relative bg-white p-4 rounded-lg shadow-sm border ${kpi.alert ? 'border-red-500 bg-red-50' : 'border-gray-200'} transition-all duration-300 h-full flex flex-col justify-between`}>
            {kpi.isV2 && (
                <div className="absolute top-2 right-2 bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">V2</div>
            )}
            <div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className={`text-sm font-medium ${kpi.alert ? 'text-red-800' : 'text-gray-600'}`}>{kpi.title}</p>
                        <p className={`text-2xl font-bold mt-1 ${kpi.alert ? 'text-red-900' : 'text-gray-800'}`}>{kpi.value}</p>
                    </div>
                    <div className={`p-2 rounded-md ${kpi.alert ? 'bg-red-200' : 'bg-gray-100'}`}>
                        <kpi.icon className={`h-6 w-6 ${kpi.alert ? 'text-red-600' : 'text-gray-600'}`} />
                    </div>
                </div>
            </div>
            {!kpi.isV2 ? (
                <div className="flex items-center mt-3 text-sm">
                    <span className={`flex items-center font-semibold ${trendColor}`}>
                        <TrendIcon size={16} className="mr-1" /> {Math.abs(kpi.trend)}%
                    </span>
                    <span className="text-gray-500 ml-2">vs período anterior</span>
                </div>
            ) : (
                <div className="mt-3 text-sm text-gray-400">Próximamente...</div>
            )}
        </div>
    );
};

// Helper outside component
const formatCurrency = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);

const AdvancedAnalytics: React.FC = () => {

    const initialKpis = {
        // Financieros
        f1: { id: 'f1', title: 'Saldo en Payku', value: formatCurrency(0), trend: 0, icon: Banknote, alert: false },
        f2: { id: 'f2', title: 'Comisiones Ganadas (30d)', value: formatCurrency(0), trend: 0, icon: BarChart2, alert: false },
        f3: { id: 'f3', title: 'Retenciones SII Pendientes', value: formatCurrency(0), trend: 0, icon: FileText, alert: false },
        f4: { id: 'f4', title: 'Payouts Fallidos (24h)', value: '0', trend: 0, icon: AlertTriangle, alert: false },
        f5: { id: 'f5', title: 'Disputas Abiertas', value: '0', trend: 0, icon: ShieldCheck, alert: false },
        f6: { id: 'f6', title: 'Chargeback Rate', value: '0%', trend: 0, icon: Percent, alert: false },
        // Operacionales
        o1: { id: 'o1', title: 'Proveedores Activos', value: '0', trend: 0, icon: Users, alert: false },
        o2: { id: 'o2', title: 'Órdenes Completadas Hoy', value: '0', trend: 0, icon: ShoppingCart, alert: false },
        o3: { id: 'o3', title: 'Tasa de Cancelación', value: '0%', trend: 0, icon: Percent, alert: false },
        o4: { id: 'o4', title: 'Tiempo Medio Respuesta Soporte', value: '0h', trend: 0, icon: Clock, alert: false, isV2: true },
        o5: { id: 'o5', title: 'Reclamos SERNAC Abiertos', value: '0', trend: 0, icon: FileWarning, alert: false },
        o6: { id: 'o6', title: 'Pendiente KYC', value: '0', trend: 0, icon: UserCheck, alert: false },
        // Salud y Retención
        s1: { id: 's1', title: 'Nuevos Clientes Hoy', value: '0', trend: 0, icon: UserCheck, alert: false },
        s2: { id: 's2', title: 'LTV Promedio (30d)', value: formatCurrency(0), trend: 0, icon: BarChart2, alert: false, isV2: true },
        s3: { id: 's3', title: 'Retention Rate (Mes 1)', value: '0%', trend: 0, icon: Percent, alert: false, isV2: true },
        s4: { id: 's4', title: 'NPS Score', value: '0', trend: 0, icon: BarChart2, alert: false, isV2: true },
        s5: { id: 's5', title: 'Liquidez Marketplace', value: formatCurrency(0), trend: 0, icon: Banknote, alert: false },
        s6: { id: 's6', title: 'Proveedores Churn (30d)', value: '0', trend: 0, icon: UserX, alert: false, isV2: true },
        // Legales
        l1: { id: 'l1', title: 'Reportes SII Pendientes', value: '0', trend: 0, icon: FileText, alert: false },
        l2: { id: 'l2', title: 'Reportes SERNAC Vencidos', value: '0', trend: 0, icon: FileWarning, alert: false },
        l3: { id: 'l3', title: 'Proveedores sin Seguro', value: '0', trend: 0, icon: Shield, alert: false },
        l4: { id: 'l4', title: 'Tickets UAF', value: '0', trend: 0, icon: AlertTriangle, alert: false, isV2: true },
        l5: { id: 'l5', title: 'Tasa de Fraude', value: '0%', trend: 0, icon: Percent, alert: false, isV2: true },
        l6: { id: 'l6', title: 'Consentimientos Pendientes', value: '0%', trend: 0, icon: ShieldCheck, alert: false, isV2: true },
    };

    const [kpis, setKpis] = useState(initialKpis);
    const [loading, setLoading] = useState(true);

    // Fetch Analytics Data
    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await adminFetch('/api/admin/analytics');
                const data = await response.json();

                if (data.status === 'success' && data.data) {
                    const stats = data.data;
                    setKpis(prev => {
                        const next = { ...prev };
                        // Update Financials
                        if (stats.f1) next.f1 = { ...next.f1, value: formatCurrency(stats.f1.value) };
                        if (stats.f2) next.f2 = { ...next.f2, value: formatCurrency(stats.f2.value) };
                        if (stats.f3) next.f3 = { ...next.f3, value: formatCurrency(stats.f3.value) };
                        if (stats.f5) next.f5 = { ...next.f5, value: stats.f5.value.toString() };

                        // Update Ops
                        if (stats.o1) next.o1 = { ...next.o1, value: stats.o1.value.toString() };
                        if (stats.o2) next.o2 = { ...next.o2, value: stats.o2.value.toString() };
                        if (stats.o6) next.o6 = { ...next.o6, value: stats.o6.value.toString() };

                        // Update Growth
                        if (stats.s1) next.s1 = { ...next.s1, value: stats.s1.value.toString() };
                        if (stats.s5) next.s5 = { ...next.s5, value: formatCurrency(stats.s5.value) };

                        // Update Legal
                        if (stats.l1) next.l1 = { ...next.l1, value: stats.l1.value.toString() };
                        if (stats.l3) next.l3 = { ...next.l3, value: stats.l3.value.toString() };

                        return next;
                    });
                }
            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
        // Optional: Polling every 60s
        const interval = setInterval(fetchAnalytics, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleDownload = (type: string) => {
        // Trigger download via direct navigation or hidden iframe
        window.open(`/api/admin/reports/${type}`, '_blank');
    };

    const kpiSections = [
        { title: 'Financieros: Flujo de Caja y Rentabilidad', ids: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] },
        { title: 'Operacionales: Salud del Marketplace', ids: ['o1', 'o2', 'o6', 'o3', 'o5', 'o4'] },
        { title: 'Salud & Retención: Crecimiento', ids: ['s1', 's5', 's6', 's2', 's3', 's4'] },
        { title: 'Legales & Cumplimiento', ids: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'] },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Analytics & Reporting</h1>
                <p className="mt-1 text-gray-600">Visibilidad en tiempo real de la salud financiera, operacional y legal del marketplace.</p>
            </div>

            {loading ? <p>Cargando métricas...</p> : (
                <>
                    {kpiSections.map(section => (
                        <div key={section.title}>
                            <h2 className="text-xl font-semibold text-gray-700 mb-4">{section.title}</h2>
                            {/* Fila Prioritaria (2 KPIs) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {section.ids.slice(0, 2).map(id => <KpiCard key={id} kpi={kpis[id as keyof typeof kpis]} />)}
                            </div>
                            {/* Fila Secundaria (4 KPIs) */}
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {section.ids.slice(2).map(id => <KpiCard key={id} kpi={kpis[id as keyof typeof kpis]} />)}
                            </div>
                        </div>
                    ))}
                </>
            )}

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Reportes Descargables</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Reporte SII */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3">
                        <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-blue-600" />
                            <div>
                                <h3 className="font-bold text-gray-800">Reporte SII Retenciones</h3>
                                <p className="text-sm text-gray-500">Formato: .xml (para subir a SII.cl)</p>
                            </div>
                        </div>
                        <button onClick={() => handleDownload('sii_retentions')} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition">
                            <Download size={16} /> Descargar Reporte Mensual
                        </button>
                    </div>

                    {/* Reporte Contador */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3">
                        <div className="flex items-center gap-3">
                            <BarChart2 className="w-8 h-8 text-green-600" />
                            <div>
                                <h3 className="font-bold text-gray-800">Libro de Ventas (Contador)</h3>
                                <p className="text-sm text-gray-500">Formato: .csv</p>
                            </div>
                        </div>
                        <button onClick={() => handleDownload('sales_book')} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition">
                            <Download size={16} /> Descargar Reporte Semanal
                        </button>
                    </div>

                    {/* Reporte SERNAC */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3">
                        <div className="flex items-center gap-3">
                            <FileWarning className="w-8 h-8 text-orange-600" />
                            <div>
                                <h3 className="font-bold text-gray-800">Reporte SERNAC</h3>
                                <p className="text-sm text-gray-500">Formato: CSV (Tickets)</p>
                            </div>
                        </div>
                        <button onClick={() => handleDownload('sernac')} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 transition">
                            <Download size={16} /> Descargar Reporte Mensual
                        </button>
                    </div>

                    {/* Settlement Payku */}
                    <div className="md:col-span-2 lg:col-span-3 border p-4 rounded-lg bg-gray-50 space-y-3">
                        <div className="flex items-center gap-3">
                            <Banknote className="w-8 h-8 text-purple-600" />
                            <div>
                                <h3 className="font-bold text-gray-800">Settlement Payku</h3>
                                <p className="text-sm text-gray-500">Descarga directa de liquidaciones de Payku.</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label htmlFor="from" className="text-sm font-medium">Desde:</label>
                                <input type="date" id="from" defaultValue="2025-07-01" className="border-gray-300 rounded-md shadow-sm text-sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="to" className="text-sm font-medium">Hasta:</label>
                                <input type="date" id="to" defaultValue="2025-07-31" className="border-gray-300 rounded-md shadow-sm text-sm" />
                            </div>
                            <button onClick={() => handleDownload('settlements')} className="flex-grow w-full sm:w-auto flex items-center justify-center gap-2 py-2 px-4 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition">
                                <Download size={16} /> Descargar Settlement
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedAnalytics;
