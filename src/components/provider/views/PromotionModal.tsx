import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, CreditCard, Sparkles, CheckCircle, AlertCircle, Clock, Plus } from 'lucide-react';
import { api } from '../../../api/client';

interface PromotionTier {
    id: string;
    name: string;
    duration_days: number;
    price_clp: number;
    description: string;
}

interface PromotionModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceId: string;
    serviceName: string;
    onSuccess: (message?: string) => void;
}

const PromotionModal: React.FC<PromotionModalProps> = ({ isOpen, onClose, serviceId, serviceName, onSuccess }) => {
    const [tiers, setTiers] = useState<PromotionTier[]>([]);
    const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [currentKeyword, setCurrentKeyword] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'now' | 'deduct'>('now');
    const [loading, setLoading] = useState(false);
    const [loadingTiers, setLoadingTiers] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch available tiers on modal open
    useEffect(() => {
        if (isOpen) {
            fetchTiers();
        }
    }, [isOpen]);

    const fetchTiers = async () => {
        try {
            setLoadingTiers(true);
            const res = await api.get('/services/promotion-tiers');
            const fetchedTiers = res.data.tiers || [];
            setTiers(fetchedTiers);
            // Auto-select first tier if available
            if (fetchedTiers.length > 0 && !selectedTierId) {
                setSelectedTierId(fetchedTiers[0].id);
            }
        } catch (err: any) {
            console.error('Error fetching tiers:', err);
            setError('No se pudieron cargar los planes disponibles');
        } finally {
            setLoadingTiers(false);
        }
    };

    const handleAddKeyword = (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = currentKeyword.trim();
        if (trimmed && !keywords.includes(trimmed) && keywords.length < 5) {
            setKeywords([...keywords, trimmed]);
            setCurrentKeyword('');
        }
    };

    const removeKeyword = (tag: string) => {
        setKeywords(keywords.filter(k => k !== tag));
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
    };

    const formatDuration = (days: number) => {
        if (days >= 30) {
            const months = Math.floor(days / 30);
            return months === 1 ? '1 mes' : `${months} meses`;
        }
        return `${days} días`;
    };

    const selectedTier = tiers.find(t => t.id === selectedTierId);

    const handleSubmit = async () => {
        if (!selectedTierId) {
            setError("Selecciona un plan de promoción.");
            return;
        }
        if (keywords.length === 0) {
            setError("Agrega al menos una palabra clave.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await api.post('/services/promotions', {
                service_id: serviceId,
                tier_id: selectedTierId,
                payment_method: paymentMethod,
                keywords: keywords
            });

            if (res.data.status === 'success') {
                if (res.data.paymentUrl) {
                    window.location.href = res.data.paymentUrl;
                    return;
                }
                onSuccess(res.data.message);
                onClose();
            }
        } catch (err: any) {
            console.error("Promotion Error:", err);
            setError(err.response?.data?.message || "Error al crear la promoción");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-brand-primary to-brand-secondary p-6 text-white text-center relative">
                        <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                        <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                            <Sparkles size={32} className="text-yellow-300" />
                        </div>
                        <h2 className="text-2xl font-bold">Destacar Servicio</h2>
                        <p className="text-white/90 text-sm mt-1 truncate px-4">{serviceName}</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Benefits */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                            <p className="flex items-start gap-2">
                                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                                <span>Aparece primero en busquedas relacionadas cuando el pago este confirmado.</span>
                            </p>
                            <p className="flex items-start gap-2 mt-2">
                                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                                <span>Sale en portada como patrocinado mientras la promocion este activa.</span>
                            </p>
                        </div>

                        {/* Tier Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Selecciona tu plan</label>
                            {loadingTiers ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : tiers.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    No hay planes disponibles. Contacta al administrador.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {tiers.map((tier) => (
                                        <button
                                            key={tier.id}
                                            type="button"
                                            onClick={() => setSelectedTierId(tier.id)}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all relative ${selectedTierId === tier.id
                                                ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-gray-900">{tier.name}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                        <Clock size={12} />
                                                        {formatDuration(tier.duration_days)}
                                                    </div>
                                                    <div className="text-sm text-gray-600 mt-2">{tier.description}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-gray-900">{formatPrice(tier.price_clp)}</div>
                                                </div>
                                            </div>
                                            {selectedTierId === tier.id && (
                                                <CheckCircle size={20} className="absolute top-4 right-4 text-brand-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Keywords Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Palabras Clave (Tags)</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={currentKeyword}
                                    onChange={(e) => setCurrentKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword(e)}
                                    placeholder="Ej: limpieza, mascotas..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                />
                                <button
                                    onClick={handleAddKeyword}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[2rem]">
                                {keywords.map(k => (
                                    <span key={k} className="inline-flex items-center bg-brand-primary/10 text-brand-primary text-xs font-bold px-2.5 py-1 rounded-full border border-brand-primary/20">
                                        <Tag size={12} className="mr-1" />
                                        {k}
                                        <button onClick={() => removeKeyword(k)} className="ml-1.5 hover:text-red-500"><X size={12} /></button>
                                    </span>
                                ))}
                                {keywords.length === 0 && <span className="text-gray-400 text-xs italic">Agrega hasta 5 palabras clave donde quieres aparecer.</span>}
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('deduct')}
                                    className={`p-3 rounded-lg border text-left transition-all relative ${paymentMethod === 'deduct' ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="font-bold text-gray-900 text-sm">Cobro diferido</div>
                                    <div className="text-xs text-gray-500 mt-1">Requiere confirmacion del administrador</div>
                                    {paymentMethod === 'deduct' && <CheckCircle size={16} className="absolute top-2 right-2 text-brand-primary" />}
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('now')}
                                    className={`p-3 rounded-lg border text-left transition-all relative ${paymentMethod === 'now' ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="font-bold text-gray-900 text-sm flex items-center">Pagar Ahora <CreditCard size={14} className="ml-1" /></div>
                                    <div className="text-xs text-gray-500 mt-1">Tarjeta Crédito/Débito (Payku)</div>
                                    {paymentMethod === 'now' && <CheckCircle size={16} className="absolute top-2 right-2 text-brand-primary" />}
                                </button>
                            </div>
                        </div>

                        {/* Cost Summary */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <div>
                                <span className="text-gray-500 text-sm">Costo total ({selectedTier ? formatDuration(selectedTier.duration_days) : '...'})</span>
                                <div className="text-xl font-bold text-gray-900">
                                    {selectedTier ? formatPrice(selectedTier.price_clp) : '...'}
                                </div>
                            </div>
                            {error && (
                                <div className="text-red-500 text-xs flex items-center max-w-[50%] leading-tight text-right">
                                    <AlertCircle size={12} className="mr-1 flex-shrink-0" /> {error}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || keywords.length === 0 || !selectedTierId || loadingTiers}
                            className="w-full bg-brand-primary hover:bg-brand-accent text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    {paymentMethod === 'now' ? 'Pagar y solicitar promocion' : 'Solicitar promocion'} <Sparkles size={18} className="ml-2" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PromotionModal;
