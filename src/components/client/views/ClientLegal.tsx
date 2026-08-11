import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Scale, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../api/client';

interface Policy {
    id: string;
    title: string;
    content: string;
    target: string;
    version: string;
    lastUpdated: string;
}

const ClientLegal: React.FC = () => {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    useEffect(() => {
        const fetchPolicies = async () => {
            try {
                setLoading(true);
                const response = await api.get('/policies?target=client');
                if (response.data.status === 'success') {
                    setPolicies(response.data.policies || []);
                }
            } catch (err: any) {
                console.error('Error fetching policies:', err);
                setError(err.response?.data?.message || 'Error al cargar políticas');
            } finally {
                setLoading(false);
            }
        };

        fetchPolicies();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Legales y Políticas</h1>
                    <p className="mt-1 text-gray-600">Revisa los términos y condiciones que rigen el uso de nuestra plataforma.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Loader2 className="h-12 w-12 text-gray-300 mx-auto animate-spin" />
                    <p className="mt-4 text-gray-500">Cargando políticas...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Legales y Políticas</h1>
                    <p className="mt-1 text-gray-600">Revisa los términos y condiciones que rigen el uso de nuestra plataforma.</p>
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
                <h1 className="text-3xl font-bold text-gray-800">Legales y Políticas</h1>
                <p className="mt-1 text-gray-600">Revisa los términos y condiciones que rigen el uso de nuestra plataforma.</p>
            </div>

            {policies.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                    {policies.map(policy => {
                        const isExpanded = expandedPolicy === policy.id.toString();
                        return (
                            <div key={policy.id} className="group">
                                <button
                                    onClick={() => setExpandedPolicy(isExpanded ? null : policy.id.toString())}
                                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <div className={`p-2 rounded-full mr-4 ${isExpanded ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-gray-500'}`}>
                                            <Scale size={20} />
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${isExpanded ? 'text-brand-primary' : 'text-gray-800'}`}>{policy.title}</h3>
                                            <p className="text-xs text-gray-500">
                                                Actualizado: {formatDate(policy.lastUpdated)} • v{policy.version}
                                            </p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                </button>
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-6 pt-0 text-sm text-gray-600 leading-relaxed border-t border-dashed border-gray-200 mx-6 mt-2 whitespace-pre-wrap">
                                                {policy.content}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                    <Scale className="h-12 w-12 text-gray-300 mx-auto" />
                    <p className="mt-4 text-gray-500">No hay políticas disponibles</p>
                </div>
            )}
        </div>
    );
};

export default ClientLegal;
