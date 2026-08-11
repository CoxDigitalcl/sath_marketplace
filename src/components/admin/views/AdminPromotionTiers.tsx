import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { Plus, Edit2, Trash2, Check, X, Clock, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';

interface PromotionTier {
    id: string;
    name: string;
    duration_days: number;
    price_clp: number;
    description: string;
    is_active: boolean;
    display_order: number;
    payment_url?: string;
}

const AdminPromotionTiers: React.FC = () => {
    const [tiers, setTiers] = useState<PromotionTier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingTier, setEditingTier] = useState<PromotionTier | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        duration_days: 30,
        price_clp: 15000,
        description: '',
        is_active: true,
        display_order: 0,
        payment_url: ''
    });

    const fetchTiers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/promotion-tiers');
            setTiers(res.data.tiers || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al cargar planes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTiers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTier) {
                await api.put(`/admin/promotion-tiers/${editingTier.id}`, formData);
            } else {
                await api.post('/admin/promotion-tiers', formData);
            }
            setEditingTier(null);
            setIsCreating(false);
            setFormData({ name: '', duration_days: 30, price_clp: 15000, description: '', is_active: true, display_order: 0, payment_url: '' });
            fetchTiers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al guardar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este plan de promoción?')) return;
        try {
            await api.delete(`/admin/promotion-tiers/${id}`);
            fetchTiers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al eliminar');
        }
    };

    const handleEdit = (tier: PromotionTier) => {
        setEditingTier(tier);
        setIsCreating(false);
        setFormData({
            name: tier.name,
            duration_days: tier.duration_days,
            price_clp: tier.price_clp,
            description: tier.description || '',
            is_active: tier.is_active,
            display_order: tier.display_order,
            payment_url: tier.payment_url || ''
        });
    };

    const handleToggleActive = async (tier: PromotionTier) => {
        try {
            await api.put(`/admin/promotion-tiers/${tier.id}`, { is_active: !tier.is_active });
            fetchTiers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al cambiar estado');
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Planes de Promoción</h1>
                    <p className="text-gray-500 text-sm mt-1">Gestiona los planes disponibles para destacar servicios</p>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(true);
                        setEditingTier(null);
                        setFormData({ name: '', duration_days: 30, price_clp: 15000, description: '', is_active: true, display_order: tiers.length + 1, payment_url: '' });
                    }}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-accent transition-colors"
                >
                    <Plus size={20} />
                    Nuevo Plan
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                    <button onClick={() => setError(null)} className="float-right"><X size={16} /></button>
                </div>
            )}

            {/* Form Modal */}
            {(isCreating || editingTier) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">{editingTier ? 'Editar Plan' : 'Crear Plan'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                    placeholder="Ej: Básico, Pro, Premium"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (días)</label>
                                    <input
                                        type="number"
                                        value={formData.duration_days}
                                        onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                        min={1}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio (CLP)</label>
                                    <input
                                        type="number"
                                        value={formData.price_clp}
                                        onChange={(e) => setFormData({ ...formData, price_clp: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                        min={0}
                                        step={1000}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                                    rows={2}
                                    placeholder="Beneficios del plan..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                                    <input
                                        type="number"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                        min={0}
                                    />
                                </div>
                                <div className="flex items-center pt-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
                                        />
                                        <span className="text-sm text-gray-700">Activo</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Link de Pago (Payku)</label>
                                <input
                                    type="url"
                                    value={formData.payment_url || ''}
                                    onChange={(e) => setFormData({ ...formData, payment_url: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                    placeholder="https://payku.com/..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsCreating(false); setEditingTier(null); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-accent transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check size={18} />
                                    {editingTier ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}

            {/* Tiers Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {tiers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No hay planes de promoción configurados
                                </td>
                            </tr>
                        ) : (
                            tiers.map((tier) => (
                                <tr key={tier.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{tier.name}</div>
                                        <div className="text-sm text-gray-500">{tier.description}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-gray-700">
                                            <Clock size={16} className="text-gray-400" />
                                            {tier.duration_days} días
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 font-medium text-gray-900">
                                            <DollarSign size={16} className="text-green-500" />
                                            {formatPrice(tier.price_clp)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleActive(tier)}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${tier.is_active
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}
                                        >
                                            {tier.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                            {tier.is_active ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(tier)}
                                                className="p-2 text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(tier.id)}
                                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default AdminPromotionTiers;
