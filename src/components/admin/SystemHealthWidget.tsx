import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, Server, AlertTriangle, CheckCircle, Database, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SystemStats {
    database: 'connected' | 'disconnected' | 'error';
    uptime: number;
    avgLatency: number;
    recentErrors: Array<{
        timestamp: string;
        method: string;
        path: string;
        message: string;
    }>;
}

const SystemHealthWidget = () => {
    const { token } = useAuthStore();
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        try {
            // Using the new endpoint
            const res = await axios.get('/api/admin/system-status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.status === 'success') {
                setStats(res.data.data);
                setError('');
            }
        } catch (err) {
            console.error('Failed to fetch system stats', err);
            setError('Métricas del sistema no disponibles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        // Poll every 10 seconds for "Live" feel
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;
    if (error) return <div className="text-red-500 text-sm">{error}</div>;
    if (!stats) return null;

    // Latency Color Logic
    const getLatencyColor = (ms: number) => {
        if (ms < 500) return 'text-green-600';
        if (ms < 2000) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-800">Estado del Sistema (En Vivo)</h2>
                <div className="flex items-center gap-1 ml-auto">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-gray-500 ml-1">Actualizando (10s)</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Connectivity */}
                <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center items-center text-center">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                        <Database className="w-4 h-4" /> Conectividad
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${stats.database === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {stats.database === 'connected' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            Base de Datos
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            API
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Tiempo activo: {(stats.uptime / 3600).toFixed(1)} hrs</p>
                </div>

                {/* 2. Latency */}
                <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center items-center text-center">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Rendimiento (Prom. 100 reqs)
                    </h3>
                    <div className={`text-4xl font-bold ${getLatencyColor(stats.avgLatency)}`}>
                        {stats.avgLatency}ms
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Objetivo: &lt; 500ms</p>
                </div>

                {/* 3. Critical Errors */}
                <div className="bg-gray-50 p-4 rounded-lg overflow-hidden flex flex-col">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Errores Críticos Recientes
                    </h3>
                    {stats.recentErrors.length === 0 ? (
                        <div className="text-green-600 text-sm flex items-center justify-center flex-1">
                            <CheckCircle className="w-4 h-4 mr-1" /> Sin errores recientes
                        </div>
                    ) : (
                        <div className="overflow-auto max-h-24">
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="text-gray-400 border-b">
                                        <th className="font-normal pb-1">Hora</th>
                                        <th className="font-normal pb-1">Método</th>
                                        <th className="font-normal pb-1">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentErrors.slice(0, 3).map((err, i) => (
                                        <tr key={i} className="border-b border-gray-100">
                                            <td className="py-1 text-gray-500">{new Date(err.timestamp).toLocaleTimeString()}</td>
                                            <td className="py-1 font-mono text-xs">{err.method} {err.path.substring(0, 10)}...</td>
                                            <td className="py-1 text-red-600 truncate max-w-[100px]" title={err.message}>{err.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemHealthWidget;
