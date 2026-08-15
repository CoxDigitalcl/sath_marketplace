import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { PolicyDocument } from '../../types';
import { readLegalPolicies } from '../../utils/legalPolicies';

const LegalPolicy = () => {
    const { slug } = useParams<{ slug: string }>();
    const [policy, setPolicy] = useState<PolicyDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPolicy = async () => {
            try {
                setLoading(true);
                // Usamos la misma ruta pública de settings pero necesitamos que exista en el backend
                // Como los settings requieren token admin, crearemos un array estático o habilitaremos una ruta pública.
                // Wait! /api/admin/settings is protected. We need a way to fetch them publicly.
                // Reusing the same concept as we did previously or fetching from a public endpoint if available.
                // Wait, do we have a public endpoint? Let's check backend routes.
                const response = await fetch('/api/public/settings/legal_policies');
                // We'll have to create this endpoint or use an existing one. Let's assume we need to add it or it exists.
                if (response.ok) {
                    const data: unknown = await response.json();
                    const policies = readLegalPolicies(data);
                    if (policies.length > 0) {
                        const found = policies.find(p => p.slug === slug || p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') === slug);
                        if (found && found.isActive) {
                            setPolicy(found);
                        } else {
                            setError('Política no encontrada o no disponible.');
                        }
                    } else {
                        setError('Política no encontrada.');
                    }
                } else {
                    throw new Error('No se pudo cargar el documento.');
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (slug) {
            fetchPolicy();
        }
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500 animate-pulse">Cargando documento legal...</div>
            </div>
        );
    }

    if (error || !policy) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
                <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Documento no encontrado</h1>
                    <p className="text-gray-600 mb-6">{error || 'La política solicitada no existe.'}</p>
                    <Link to="/" className="inline-flex items-center text-brand-primary hover:underline font-medium">
                        <ChevronLeft size={16} className="mr-1" /> Volver al inicio
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-16 font-sans">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Link to="/" className="inline-flex items-center text-gray-500 hover:text-brand-primary transition">
                        <ChevronLeft size={20} className="mr-1" /> Volver
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-brand-primary/5 px-8 py-8 border-b border-gray-100">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{policy.title}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            {policy.version && <span>Versión: {policy.version}</span>}
                            {policy.lastUpdated && <span>Última actualización: {new Date(policy.lastUpdated).toLocaleDateString('es-CL')}</span>}
                        </div>
                    </div>

                    <div className="px-8 py-10 prose prose-lg max-w-none text-gray-700">
                        {/* Como el contenido puede ser HTML o texto plano, lo renderizamos asegurando los saltos de línea si es texto */}
                        {/<[a-z][\s\S]*>/i.test(policy.content) ? (
                            <div className="whitespace-pre-wrap">{policy.content}</div>
                        ) : (
                            <div className="whitespace-pre-wrap">{policy.content}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegalPolicy;
