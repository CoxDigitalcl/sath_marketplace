
import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { api } from '../../../api/client';

// Mock Policies removed. fetching from API.

const ProviderLegal: React.FC = () => {
    const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
    const [policies, setPolicies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const fetchPolicies = async () => {
            try {
                const res = await api.get('/policies');
                if (res.data.status === 'success') {
                    setPolicies(res.data.policies);
                }
            } catch (error) {
                console.error("Error fetching policies", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPolicies();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Legales y Políticas</h1>
                <p className="mt-1 text-gray-600">Revisa los términos, condiciones y acuerdos que rigen tu actividad como proveedor.</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                {loading ? <div className="p-6 text-center text-gray-500">Cargando políticas...</div> :
                    policies.length === 0 ? <div className="p-6 text-center text-gray-500">No hay políticas disponibles.</div> :
                        policies.map(policy => {
                            const isExpanded = expandedPolicy === policy.id;
                            return (
                                <div key={policy.id} className="group">
                                    <button
                                        onClick={() => setExpandedPolicy(isExpanded ? null : policy.id)}
                                        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <div className={`p-2 rounded-full mr-4 ${isExpanded ? 'bg-brand-secondary/10 text-brand-secondary' : 'bg-gray-100 text-gray-500'}`}>
                                                <Scale size={20} />
                                            </div>
                                            <div>
                                                <h3 className={`font-semibold ${isExpanded ? 'text-brand-secondary' : 'text-gray-800'}`}>{policy.title}</h3>
                                                {/* Helper to format ISO date if needed */}
                                                <p className="text-xs text-gray-500">Actualizado: {new Date(policy.last_updated || policy.created_at).toLocaleDateString()} • v{policy.version}</p>
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
                                                <div className="p-6 pt-0 text-sm text-gray-600 leading-relaxed border-t border-dashed border-gray-200 mx-6 mt-2">
                                                    {policy.content}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
            </div>
        </div>
    );
};

export default ProviderLegal;
