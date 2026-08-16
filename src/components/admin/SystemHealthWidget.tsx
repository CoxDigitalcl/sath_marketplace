import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, AlertTriangle, CheckCircle, Clock, Database, Gauge, HardDrive, Server } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SystemStats {
    database: 'connected' | 'disconnected' | 'error';
    uptime: number;
    avgLatency: number;
    memoryUsage: number;
    latencyMs?: { average: number; p50: number; p95: number; p99: number };
    httpStatus?: {
        total: number;
        clientErrorRate: number;
        serverErrorRate: number;
        rateLimited: number;
    };
    recentErrors: Array<{
        timestamp: string;
        method: string;
        path: string;
        message: string;
        correlationId?: string;
    }>;
    operational?: {
        database: { status: string; total: number; idle: number; waiting: number };
        cache: { keys?: number; hitRate?: number };
        outbox: { pending: number; failed: number; oldestPendingSeconds: number };
        storage: {
            uploads: { available: boolean; freePercent?: number };
            privateUploads: { available: boolean; freePercent?: number };
        };
        signals: Array<{ code: string; severity: string }>;
    };
    alerts?: { received: number; deduplicated: number; deliveryFailures: number };
}

const formatPercent = (value = 0) => `${value.toFixed(2)}%`;

const SystemHealthWidget = () => {
    const { token } = useAuthStore();
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchStats = async () => {
            try {
                const response = await axios.get('/api/admin/system-status', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (mounted && response.data.status === 'success') {
                    setStats(response.data.data);
                    setError('');
                }
            } catch {
                if (mounted) setError('Métricas del sistema no disponibles');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        void fetchStats();
        const interval = setInterval(fetchStats, 30_000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [token]);

    if (loading) return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
    if (error) return <div className="text-sm text-red-600">{error}</div>;
    if (!stats) return null;

    const latency = stats.latencyMs || {
        average: stats.avgLatency,
        p50: stats.avgLatency,
        p95: stats.avgLatency,
        p99: stats.avgLatency,
    };
    const operational = stats.operational;
    const signalCount = operational?.signals.length || 0;
    const healthy = stats.database === 'connected' && signalCount === 0;
    const latencyColor = latency.p95 < 500 ? 'text-green-600' : latency.p95 < 2000 ? 'text-amber-600' : 'text-red-600';

    return (
        <section className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="system-health-title">
            <div className="mb-5 flex flex-wrap items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-600" />
                <h2 id="system-health-title" className="text-lg font-bold text-gray-800">Estado operativo</h2>
                <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${healthy ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                    {healthy ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {healthy ? 'Sin señales activas' : `${signalCount} señal(es)`}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <Database className="h-4 w-4" /> Base de datos
                    </h3>
                    <p className={`text-xl font-bold ${stats.database === 'connected' ? 'text-green-700' : 'text-red-700'}`}>
                        {stats.database === 'connected' ? 'Conectada' : 'No disponible'}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                        Pool: {operational?.database.total ?? 0} total · {operational?.database.idle ?? 0} libres · {operational?.database.waiting ?? 0} esperando
                    </p>
                </article>

                <article className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <Clock className="h-4 w-4" /> Latencia HTTP
                    </h3>
                    <p className={`text-3xl font-bold ${latencyColor}`}>{latency.p95} ms</p>
                    <p className="mt-2 text-xs text-gray-500">p50 {latency.p50} · p95 {latency.p95} · p99 {latency.p99}</p>
                </article>

                <article className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <Gauge className="h-4 w-4" /> Respuestas HTTP
                    </h3>
                    <p className="text-sm text-gray-700">5xx: <strong>{formatPercent(stats.httpStatus?.serverErrorRate)}</strong></p>
                    <p className="text-sm text-gray-700">4xx: <strong>{formatPercent(stats.httpStatus?.clientErrorRate)}</strong></p>
                    <p className="mt-2 text-xs text-gray-500">429 recientes: {stats.httpStatus?.rateLimited ?? 0} de {stats.httpStatus?.total ?? 0}</p>
                </article>

                <article className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <Server className="h-4 w-4" /> Cola y caché
                    </h3>
                    <p className="text-sm text-gray-700">Outbox: <strong>{operational?.outbox.pending ?? 0}</strong> pendientes · <strong>{operational?.outbox.failed ?? 0}</strong> con error</p>
                    <p className="mt-2 text-xs text-gray-500">Caché: {operational?.cache.keys ?? 0} claves · hit {formatPercent(operational?.cache.hitRate)}</p>
                </article>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <article className="rounded-lg border border-gray-100 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <HardDrive className="h-4 w-4" /> Almacenamiento y proceso
                    </h3>
                    <p className="text-sm text-gray-700">Uploads libres: {formatPercent(operational?.storage.uploads.freePercent)}</p>
                    <p className="text-sm text-gray-700">Privados libres: {formatPercent(operational?.storage.privateUploads.freePercent)}</p>
                    <p className="mt-2 text-xs text-gray-500">Memoria: {stats.memoryUsage.toFixed(1)} MB · uptime {(stats.uptime / 3600).toFixed(1)} h</p>
                </article>

                <article className="rounded-lg border border-gray-100 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <AlertTriangle className="h-4 w-4" /> Errores recientes
                    </h3>
                    {stats.recentErrors.length === 0 ? (
                        <p className="flex items-center gap-1 text-sm text-green-700"><CheckCircle className="h-4 w-4" /> Sin errores 5xx recientes</p>
                    ) : (
                        <ul className="space-y-2 text-xs text-gray-700">
                            {stats.recentErrors.slice(0, 3).map((recentError) => (
                                <li key={`${recentError.timestamp}-${recentError.correlationId}`} className="flex flex-wrap gap-x-2">
                                    <time className="text-gray-500">{new Date(recentError.timestamp).toLocaleTimeString()}</time>
                                    <span className="font-mono">{recentError.method} {recentError.path}</span>
                                    <span className="text-red-600">{recentError.message}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </article>
            </div>
        </section>
    );
};

export default SystemHealthWidget;
