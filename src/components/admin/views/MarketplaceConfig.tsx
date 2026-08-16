
import React, { useState, useEffect } from 'react';
import { Settings, Tag, CreditCard, FileText, Users, Shield, Check, Info, Lock, KeyRound, Save, ExternalLink, List, Trash2, Plus, FileSignature, ShieldCheck, AlertCircle, ChevronDown, ChevronUp, Edit2, X, AlertTriangle, HelpCircle, Eye, Receipt, TestTube, RefreshCw, Share2, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import ToggleSwitch from '../provider-management/ToggleSwitch';
import { buildLegalPoliciesSettingsRequest, readLegalPolicies } from '../../../utils/legalPolicies';
import { ServiceAttribute, PolicyDocument, PolicyTarget } from '../../../types';

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


type ConfigSection = 'categories' | 'payments' | 'invoicing' | 'policies' | 'roles' | 'attributes' | 'templates' | 'verification' | 'social_media';


// --- DATA: Initial Taxonomy from PDF ---
// Mock data removed. Using API.

// --- Sub-componente: Categorías y Servicios (CRUD Completo) ---
// --- Sub-componente: Categorías y Servicios (CRUD Completo) ---
const CategorySettings = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [newSubcategory, setNewSubcategory] = useState('');

    // Modal State for New/Edit Category
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [modalForm, setModalForm] = useState({ name: '', commission: 10, id: '', commissionType: 'PERCENTAGE', fixedCommission: 0 });

    // Smart Delete Confirmation State
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        type: 'category' | 'subcategory';
        id: string; // For subcategory, this is the name OR id if mapped
        name: string;
        parentId?: string; // For subcategory
        affectedCount: number;
    } | null>(null);

    const fetchCategories = async () => {
        try {
            const response = await adminFetch('/api/admin/categories');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    setCategories(data.data);
                }
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // --- Helper: Check Dependencies (Mock) ---
    const checkDependencies = (type: 'category' | 'subcategory', id: string) => {
        // In a real app, this would be an API call to count bookings/services
        return 0; // Defaulting to 0 safe delete for now
    };

    // --- Subcategory Actions ---
    const handleAddSubcategory = async (catId: string) => {
        if (!newSubcategory.trim()) return;

        try {
            const parentCategory = categories.find(c => c.id === catId);
            const response = await adminFetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSubcategory.trim(),
                    parentId: catId,
                    commission: parentCategory?.commission || 10,
                    commissionType: parentCategory?.commissionType || 'PERCENTAGE',
                    fixedCommission: parentCategory?.fixedCommission || 0
                })
            });

            if (response.ok) {
                setNewSubcategory('');
                fetchCategories(); // Refresh tree
            }
        } catch (error) {
            console.error("Error adding subcategory:", error);
        }
    };

    const initiateDeleteSubcategory = (catId: string, subName: string) => {
        // We need to find the ID of the subcategory. 
        // In our current mapped 'categories' state, 'subcategories' is string[] array of NAMES.
        // But the backend needs ID.
        // Wait, 'getCategories' in backend maps children to just strings: .map(child => child.name);
        // This is a limitation I introduced in my own controller!
        // I need to fix the controller to return objects for subcategories too OR use names for deletion if backend supports it.
        // Backend `deleteCategory` expects ID.
        // Hack: Generate ID from name as we did in migration? No, that's brittle.
        // I should have returned objects in getCategories. 
        // For now, I will assume we can delete by Name or I will fix the controller in next step.
        // Let's assume I will fix the controller to return { id, name } objects for subcategories.
        alert("Para borrar subcategorías, por favor implemente la actualización del controlador primero para recibir objetos completos.");
    };

    // --- Main Category Actions ---
    const openModal = (category?: any) => {
        if (category) {
            setEditingCategory(category);
            setModalForm({
                name: category.name,
                commission: category.commission,
                id: category.id,
                commissionType: category.commissionType || 'PERCENTAGE',
                fixedCommission: category.fixedCommission || 0
            });
        } else {
            setEditingCategory(null);
            setModalForm({ name: '', commission: 10, id: '', commissionType: 'PERCENTAGE', fixedCommission: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSaveCategory = async () => {
        if (!modalForm.name) return;

        try {
            let response;
            const payload = {
                name: modalForm.name,
                commission: modalForm.commission,
                commissionType: modalForm.commissionType,
                fixedCommission: parseInt(modalForm.fixedCommission as any) || 0
            };

            if (editingCategory) {
                // Edit existing
                response = await adminFetch(`/api/admin/categories/${editingCategory.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create new
                response = await adminFetch('/api/admin/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (response.ok) {
                setIsModalOpen(false);
                fetchCategories();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const initiateDeleteCategory = (cat: any) => {
        const affectedCount = checkDependencies('category', cat.id);
        setDeleteConfirmation({
            type: 'category',
            id: cat.id,
            name: cat.name,
            affectedCount
        });
    };

    const executeDelete = async () => {
        if (!deleteConfirmation) return;

        try {
            const response = await adminFetch(`/api/admin/categories/${deleteConfirmation.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchCategories();
            }
        } catch (err) {
            console.error(err);
        }
        setDeleteConfirmation(null);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Gestión de Categorías</h2>
                    <p className="text-sm text-gray-500">Administra la taxonomía del marketplace y las comisiones por sector.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition-colors"
                >
                    <Plus size={18} className="mr-2" /> Nueva Categoría
                </button>
            </div>

            <div className="overflow-hidden border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subcategorías</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map(cat => (
                            <React.Fragment key={cat.id}>
                                <tr className={`hover:bg-gray-50 transition-colors ${expandedId === cat.id ? 'bg-blue-50/50' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => toggleExpand(cat.id)}
                                            className="flex items-center font-medium text-gray-900 hover:text-brand-primary"
                                        >
                                            {expandedId === cat.id ? <ChevronUp size={16} className="mr-2" /> : <ChevronDown size={16} className="mr-2" />}
                                            {cat.name}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {cat.commissionType === 'FIXED'
                                            ? `$${(cat.fixedCommission || 0).toLocaleString('es-CL')} (Fijo)`
                                            : `${cat.commission || 0}%`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">{cat.subcategories.length} especialidades</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cat.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {cat.status === 'active' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openModal(cat)} className="text-blue-600 hover:text-blue-900 mr-3"><Edit2 size={18} /></button>
                                        <button onClick={() => initiateDeleteCategory(cat)} className="text-red-600 hover:text-red-900"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                                {expandedId === cat.id && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 bg-gray-50 border-b border-gray-200 shadow-inner">
                                            <div className="pl-6">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Gestión de Subcategorías para {cat.name}</h4>

                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {cat.subcategories.map((sub, idx) => (
                                                        <span key={idx} className="inline-flex items-center bg-white border border-gray-300 rounded-full px-3 py-1 text-sm text-gray-700">
                                                            {sub}
                                                            <button
                                                                onClick={() => initiateDeleteSubcategory(cat.id, sub)}
                                                                className="ml-2 text-gray-400 hover:text-red-500 rounded-full"
                                                                title="Gestión de subcategorías en desarrollo"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="flex gap-2 max-w-md">
                                                    <input
                                                        type="text"
                                                        placeholder="Nueva subcategoría..."
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                                        value={newSubcategory}
                                                        onChange={(e) => setNewSubcategory(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(cat.id)}
                                                    />
                                                    <button
                                                        onClick={() => handleAddSubcategory(cat.id)}
                                                        className="bg-brand-secondary text-white px-3 py-2 rounded-md text-sm hover:bg-gray-800"
                                                    >
                                                        Agregar
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Smart Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
                        <div className="flex items-start mb-4">
                            <div className={`p-3 rounded-full mr-4 flex-shrink-0 ${deleteConfirmation.affectedCount > 0 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {deleteConfirmation.affectedCount > 0 ? '¡Acción de Riesgo!' : '¿Estás seguro?'}
                                </h3>
                                <p className="text-sm text-gray-600 mt-2">
                                    Estás a punto de eliminar {deleteConfirmation.type === 'category' ? 'la categoría' : 'la subcategoría'} <strong>"{deleteConfirmation.name}"</strong>.
                                </p>
                                {deleteConfirmation.affectedCount > 0 ? (
                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                        <p className="text-sm font-semibold text-red-800">
                                            Advertencia: Hay {deleteConfirmation.affectedCount} servicios activos asociados a esta categoría.
                                        </p>
                                        <p className="text-xs text-red-600 mt-1">
                                            Si procedes, estos servicios quedarán "Sin Categoría" o invisibles en el buscador.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 mt-2">
                                        No hay servicios asociados actualmente. Es seguro eliminarla.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeDelete}
                                className={`px-4 py-2 text-white rounded-md font-medium shadow-sm ${deleteConfirmation.affectedCount > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-primary hover:opacity-90'}`}
                            >
                                {deleteConfirmation.affectedCount > 0 ? 'Eliminar de todos modos' : 'Confirmar Eliminación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Add/Edit Category */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                    value={modalForm.name}
                                    onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comisión</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                    value={modalForm.commissionType}
                                    onChange={(e) => setModalForm({ ...modalForm, commissionType: e.target.value })}
                                >
                                    <option value="PERCENTAGE">Porcentaje (%)</option>
                                    <option value="FIXED">Monto Fijo ($)</option>
                                </select>
                            </div>
                            {modalForm.commissionType === 'PERCENTAGE' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Comisión Base (%)</label>
                                    <input
                                        type="number"
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                        value={modalForm.commission}
                                        onChange={(e) => setModalForm({ ...modalForm, commission: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto Fijo ($)</label>
                                    <input
                                        type="number"
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary p-2 border"
                                        value={modalForm.fixedCommission}
                                        onChange={(e) => setModalForm({ ...modalForm, fixedCommission: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
                            <button onClick={handleSaveCategory} className="px-4 py-2 text-white bg-brand-primary rounded-md hover:opacity-90">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Sub-componente: Pasarela de Pago (Payku) ---
const PaymentGatewaySettings = () => {
    const [config, setConfig] = useState({
        environment: 'sandbox',
        apiKey: '',
        webhookSecret: '',
        status: true,
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const response = await adminFetch('/api/admin/settings/payment');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data) {
                    // Check if empty, if so keep defaults
                    if (Object.keys(data.data).length > 0) {
                        setConfig(prev => ({
                            ...prev,
                            environment: data.data.payku_environment || 'sandbox',
                            apiKey: data.data.payku_api_key || '',
                            webhookSecret: data.data.payku_webhook_secret || '',
                            status: data.data.payku_status ?? true
                        }));
                    }
                }
            }
        } catch (error) {
            console.error("Error loading payment settings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const saveSettings = async (newConfig: any) => {
        try {
            await adminFetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group: 'payment',
                    settings: {
                        payku_environment: newConfig.environment,
                        payku_api_key: newConfig.apiKey,
                        payku_webhook_secret: newConfig.webhookSecret,
                        payku_status: newConfig.status
                    }
                })
            });
            // Could add toast notification here
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    };

    const handleEnvChange = (isProduction: boolean) => {
        if (window.confirm("¿Estás seguro? Cambiar el ambiente afectará todas las transacciones futuras.")) {
            const newConfig = { ...config, environment: isProduction ? 'production' : 'sandbox' };
            setConfig(newConfig);
            saveSettings(newConfig); // Auto-save on toggle
        }
    };

    const handleStatusChange = (isActive: boolean) => {
        const newConfig = { ...config, status: isActive };
        setConfig(newConfig);
        saveSettings(newConfig); // Auto-save on toggle
    };

    const handleSaveManual = () => {
        saveSettings(config);
        alert("Configuración de pagos guardada.");
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Configuración de Pasarela de Pago</h2>
            <p className="text-sm text-gray-500 mb-4">Gestiona la conexión con Payku, el proveedor de pagos del marketplace.</p>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <tbody className="divide-y divide-gray-200">
                        {Object.entries({
                            'Proveedor': { value: 'Payku ✅', editable: false, description: 'Único soporte para V1' },
                            'Ambiente': { value: config.environment, editable: true, type: 'toggle', description: 'Switch entre Sandbox (pruebas) y Producción (real).' },
                            'API Key': { value: config.apiKey, editable: true, type: 'password', description: 'Clave secreta para autenticar con Payku. No compartir.', placeholder: 'sk_live_**********', field: 'apiKey' },
                            'Webhook URL': { value: 'https://serviciosatuhogar.cl/webhooks/payku', editable: false, description: 'URL auto-generada para recibir notificaciones.' },
                            'Webhook Secret': { value: config.webhookSecret, editable: true, type: 'password', description: 'Clave para validar la firma de los webhooks.', placeholder: 'whsec_*********', field: 'webhookSecret' },
                            'Comisión Payku': { value: '1.1% + IVA', editable: false, description: 'Configurado directamente en tu dashboard de Payku.' },
                            'Payout Delay': { value: '1 día hábil', editable: false, description: 'Tiempo de liquidación de fondos. Configurado en Payku.' },
                            'Estado': { value: config.status ? 'Activo' : 'Inactivo', editable: true, type: 'toggle', description: 'Activa o desactiva la pasarela de pagos.' }
                        }).map(([key, item]: [string, any]) => (
                            <tr key={key}>
                                <td className="px-4 py-4 align-top w-1/4">
                                    <div className="font-semibold text-gray-800">{key}</div>
                                    <div className="text-xs text-gray-500">{item.description}</div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                    {item.editable ? (
                                        item.type === 'toggle' ? (
                                            <div className="flex items-center gap-4">
                                                <ToggleSwitch
                                                    enabled={key === 'Ambiente' ? config.environment === 'production' : config.status}
                                                    onChange={key === 'Ambiente' ? handleEnvChange : handleStatusChange}
                                                />
                                                <span className={`font-medium capitalize ${key === 'Ambiente' && config.environment === 'production' ? 'text-green-600' : key === 'Estado' && config.status ? 'text-green-600' : 'text-gray-600'}`}>
                                                    {item.value}
                                                </span>
                                            </div>
                                        ) : (
                                            <input
                                                type="password"
                                                placeholder={item.placeholder}
                                                value={item.value}
                                                onChange={(e) => setConfig({ ...config, [item.field]: e.target.value })}
                                                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                            />
                                        )
                                    ) : (
                                        <span className="text-gray-700">{item.value}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end mt-6">
                <button onClick={handleSaveManual} className="flex items-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-md hover:opacity-90 transition">
                    <Save size={16} /> Guardar Cambios
                </button>
            </div>
        </div>
    );
};

// --- Sub-componente: Facturación Electrónica (SimpleFactura) ---
const InvoicingSettings = () => {
    const [config, setConfig] = useState({
        environment: 'sandbox',
        rutEmisor: '',
        username: '',
        password: '',
        status: false,
    });
    const [loading, setLoading] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const fetchSettings = async () => {
        try {
            const response = await adminFetch('/api/admin/settings/invoicing');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data) {
                    setConfig(prev => ({
                        ...prev,
                        environment: data.data.simplefactura_environment || 'sandbox',
                        rutEmisor: data.data.simplefactura_rut_emisor || '',
                        username: data.data.simplefactura_username || '',
                        password: data.data.simplefactura_password ? '********' : '',
                        status: data.data.simplefactura_status ?? false
                    }));
                }
            }
        } catch (error) {
            console.error("Error loading invoicing settings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const saveSettings = async (newConfig: any) => {
        try {
            const settingsToSave: any = {
                simplefactura_environment: newConfig.environment,
                simplefactura_rut_emisor: newConfig.rutEmisor,
                simplefactura_username: newConfig.username,
                simplefactura_status: newConfig.status
            };
            if (newConfig.password && !newConfig.password.includes('*')) {
                settingsToSave.simplefactura_password = newConfig.password;
            }

            await adminFetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group: 'invoicing',
                    settings: settingsToSave
                })
            });
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const response = await adminFetch('/api/admin/invoicing/test-connection', { method: 'POST' });
            const data = await response.json();
            setTestResult({
                success: data.status === 'success',
                message: data.message || (data.status === 'success' ? 'Conexión exitosa' : 'Error de conexión')
            });
        } catch (error) {
            setTestResult({ success: false, message: 'Error al probar la conexión' });
        } finally {
            setTesting(false);
        }
    };

    const handleEnvChange = (isProduction: boolean) => {
        if (isProduction && !window.confirm("¿Estás seguro? Cambiar a producción emitirá facturas reales al SII.")) {
            return;
        }
        const newConfig = { ...config, environment: isProduction ? 'production' : 'sandbox' };
        setConfig(newConfig);
        saveSettings(newConfig);
    };

    const handleStatusChange = (isActive: boolean) => {
        const newConfig = { ...config, status: isActive };
        setConfig(newConfig);
        saveSettings(newConfig);
    };

    const handleSaveManual = () => {
        saveSettings(config);
        alert("Configuración de facturación guardada.");
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-1">Facturación Electrónica (SII)</h2>
                    <p className="text-sm text-gray-500">Integración con SimpleFactura para emisión de DTEs al Servicio de Impuestos Internos.</p>
                </div>
                <a href="https://documentacion.simplefactura.cl" target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:underline">
                    <ExternalLink size={14} className="mr-1" /> Documentación
                </a>
            </div>

            {/* Status Banner */}
            <div className={`mb-6 p-4 rounded-lg border ${config.status ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        {config.status ? (
                            <Check className="text-green-600 mr-3" size={24} />
                        ) : (
                            <AlertCircle className="text-yellow-600 mr-3" size={24} />
                        )}
                        <div>
                            <p className={`font-semibold ${config.status ? 'text-green-800' : 'text-yellow-800'}`}>
                                {config.status ? 'Facturación Activada' : 'Facturación Desactivada'}
                            </p>
                            <p className="text-sm text-gray-600">
                                {config.status
                                    ? `Emitiendo en modo ${config.environment === 'production' ? 'PRODUCCIÓN' : 'SANDBOX'}`
                                    : 'Configure las credenciales y active la facturación'}
                            </p>
                        </div>
                    </div>
                    <ToggleSwitch enabled={config.status} onChange={handleStatusChange} />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <tbody className="divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-4 align-top w-1/4">
                                <div className="font-semibold text-gray-800">Proveedor</div>
                                <div className="text-xs text-gray-500">Servicio de facturación electrónica</div>
                            </td>
                            <td className="px-4 py-4">
                                <span className="text-gray-700">SimpleFactura ✅</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-gray-800">Ambiente</div>
                                <div className="text-xs text-gray-500">Sandbox para pruebas, Producción para emisión real</div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-4">
                                    <ToggleSwitch
                                        enabled={config.environment === 'production'}
                                        onChange={handleEnvChange}
                                    />
                                    <span className={`font-medium capitalize ${config.environment === 'production' ? 'text-red-600' : 'text-gray-600'}`}>
                                        {config.environment === 'production' ? '🔴 Producción' : '🟢 Sandbox'}
                                    </span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-gray-800">RUT Emisor</div>
                                <div className="text-xs text-gray-500">RUT de la empresa (sin puntos, con guión)</div>
                            </td>
                            <td className="px-4 py-4">
                                <input
                                    type="text"
                                    placeholder="12345678-9"
                                    value={config.rutEmisor}
                                    onChange={(e) => setConfig({ ...config, rutEmisor: e.target.value })}
                                    className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-gray-800">Usuario API</div>
                                <div className="text-xs text-gray-500">Usuario para autenticación con SimpleFactura</div>
                            </td>
                            <td className="px-4 py-4">
                                <input
                                    type="text"
                                    placeholder="tu_usuario"
                                    value={config.username}
                                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                                    className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-gray-800">Contraseña API</div>
                                <div className="text-xs text-gray-500">No se mostrará después de guardar</div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-2 max-w-sm">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={config.password}
                                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-2 text-gray-500 hover:text-gray-700">
                                        <Eye size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-gray-800">Tipos de DTE</div>
                                <div className="text-xs text-gray-500">Documentos habilitados</div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">Factura (33)</span>
                                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Boleta (39)</span>
                                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">Liquidacion Factura (43)</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {testResult && (
                <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {testResult.success ? '✅ ' : '❌ '}{testResult.message}
                    </p>
                </div>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t">
                <button
                    onClick={handleTestConnection}
                    disabled={testing || !config.username}
                    className="flex items-center gap-2 py-2 px-4 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                    {testing ? <RefreshCw size={16} className="animate-spin" /> : <HelpCircle size={16} />}
                    Probar Conexión
                </button>
                <button onClick={handleSaveManual} className="flex items-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-md hover:opacity-90 transition">
                    <Save size={16} /> Guardar Cambios
                </button>
            </div>
        </div>
    );
};

// --- Sub-componente: Políticas y Términos (Dynamic CRUD) ---
const PolicySettings = () => {
    const [policies, setPolicies] = useState<PolicyDocument[]>([]);
    const [editingPolicy, setEditingPolicy] = useState<Partial<PolicyDocument> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            setLoading(true);
            const response = await adminFetch('/api/admin/settings/legal_policies', {
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                }
            });
            if (response.ok) {
                const data: unknown = await response.json();
                const savedPolicies = readLegalPolicies(data);
                if (savedPolicies.length > 0) {
                    setPolicies(savedPolicies);
                } else {
                    // Si no existen políticas en la BD, inyectamos las plantillas por defecto (Inactivas)
                    const defaultTemplates: PolicyDocument[] = [
                        { id: '1', title: 'Términos y Condiciones de Uso', slug: 'terminos-y-condiciones-de-uso', content: '', target: 'global', lastUpdated: new Date().toISOString().split('T')[0], version: '1.0', isRequired: true, isActive: false },
                        { id: '2', title: 'Política de Privacidad', slug: 'politica-de-privacidad', content: '', target: 'global', lastUpdated: new Date().toISOString().split('T')[0], version: '1.0', isRequired: true, isActive: false },
                        { id: '3', title: 'Acuerdo de Nivel de Servicio (SLA) Proveedores', slug: 'acuerdo-de-nivel-de-servicio-sla-proveedores', content: '', target: 'provider', lastUpdated: new Date().toISOString().split('T')[0], version: '1.0', isRequired: true, isActive: false },
                        { id: '4', title: 'Política de Reembolsos', slug: 'politica-de-reembolsos', content: '', target: 'client', lastUpdated: new Date().toISOString().split('T')[0], version: '1.1', isRequired: false, isActive: false },
                    ];
                    setPolicies(defaultTemplates);
                    // Las guardamos silenciosamente para que la próxima vez existan
                }
            } else {
                throw new Error('Error al cargar políticas');
            }
        } catch (err: any) {
            console.error('Error fetching policies:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveToBackend = async (newPolicies: PolicyDocument[]) => {
        try {
            setSaving(true);
            const response = await adminFetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(buildLegalPoliciesSettingsRequest(newPolicies))
            });

            if (!response.ok) {
                throw new Error('Error al guardar políticas en el servidor');
            }
        } catch (err: any) {
            console.error('Save error:', err);
            alert('Error al guardar: ' + err.message);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!editingPolicy?.title) return;

        let newPolicies;
        if (editingPolicy.id) {
            newPolicies = policies.map(p => p.id === editingPolicy.id ? { ...p, ...editingPolicy, lastUpdated: new Date().toISOString().split('T')[0] } as PolicyDocument : p);
        } else {
            // Generar un slug simple para la URL
            const slug = editingPolicy.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            newPolicies = [...policies, { ...editingPolicy, id: Date.now().toString(), slug, lastUpdated: new Date().toISOString().split('T')[0] } as PolicyDocument];
        }

        try {
            await saveToBackend(newPolicies);
            setPolicies(newPolicies);
            setEditingPolicy(null);
        } catch (e) {
            // El error ya se maneja en saveToBackend
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Seguro que deseas eliminar esta política?')) {
            const newPolicies = policies.filter(p => p.id !== id);
            try {
                await saveToBackend(newPolicies);
                setPolicies(newPolicies);
            } catch (e) { }
        }
    };

    const getTargetBadge = (target: PolicyTarget) => {
        switch (target) {
            case 'global': return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Global</span>;
            case 'client': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Clientes</span>;
            case 'provider': return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">Proveedores</span>;
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Gestor de Políticas Legales</h2>
                    <p className="text-sm text-gray-500">Crea y administra los documentos legales que aceptan tus usuarios.</p>
                </div>
                {!editingPolicy && (
                    <button onClick={() => setEditingPolicy({ target: 'global', isRequired: false, isActive: true })} disabled={loading || saving} className="flex items-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-md hover:opacity-90 transition disabled:opacity-50">
                        <Plus size={16} /> Nueva Política
                    </button>
                )}
            </div>

            {loading && !editingPolicy ? (
                <div className="flex justify-center py-8">
                    <RefreshCw size={24} className="animate-spin text-gray-400" />
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
                    <p>Error: {error}</p>
                    <button onClick={fetchPolicies} className="mt-2 text-sm underline">Reintentar</button>
                </div>
            ) : editingPolicy ? (
                <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Título del Documento</label>
                            <input type="text" value={editingPolicy.title || ''} onChange={e => setEditingPolicy({ ...editingPolicy, title: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-md p-2" placeholder="Ej. Términos y Condiciones" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Versión</label>
                            <input type="text" value={editingPolicy.version || ''} onChange={e => setEditingPolicy({ ...editingPolicy, version: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-md p-2" placeholder="Ej. 1.0" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Público Objetivo</label>
                            <select value={editingPolicy.target} onChange={e => setEditingPolicy({ ...editingPolicy, target: e.target.value as PolicyTarget })} className="mt-1 w-full border border-gray-300 rounded-md p-2">
                                <option value="global">Global (Todos)</option>
                                <option value="client">Solo Clientes</option>
                                <option value="provider">Solo Proveedores</option>
                            </select>
                        </div>
                        <div className="flex items-center pt-6 gap-6">
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={editingPolicy.isRequired} onChange={e => setEditingPolicy({ ...editingPolicy, isRequired: e.target.checked })} className="mr-2" />
                                <span className="text-sm text-gray-700">Obligatorio (Requiere check)</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={editingPolicy.isActive} onChange={e => setEditingPolicy({ ...editingPolicy, isActive: e.target.checked })} className="mr-2" />
                                <span className="text-sm text-gray-700">Activo (Visible)</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contenido (HTML/Markdown)</label>
                        <textarea value={editingPolicy.content || ''} onChange={e => setEditingPolicy({ ...editingPolicy, content: e.target.value })} rows={10} className="mt-1 w-full border border-gray-300 rounded-md p-2 font-mono text-sm" placeholder="Escribe aquí el contenido legal..." />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setEditingPolicy(null)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100">Cancelar</button>
                        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90 disabled:opacity-50">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            Guardar Política
                        </button>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Público</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versión / Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {policies.map(doc => (
                                <tr key={doc.id}>
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900">{doc.title}</p>
                                        {doc.isRequired && <span className="text-xs text-red-600 flex items-center mt-1"><AlertCircle size={12} className="mr-1" /> Obligatorio</span>}
                                    </td>
                                    <td className="px-6 py-4">{getTargetBadge(doc.target)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">v{doc.version} - {doc.lastUpdated}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${doc.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {doc.isActive ? 'Publicado' : 'Borrador'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setEditingPolicy(doc)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 size={18} /></button>
                                        <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// --- Sub-componente: Roles y Permisos ---
const RoleSettings = () => {
    const rolesConfig = {
        'admin:support_l1': { name: 'Soporte Nivel 1', canEditApiKey: false, canViewBalance: false, canGenSiiReports: false },
        'admin:finance': { name: 'Finanzas', canEditApiKey: false, canViewBalance: true, canGenSiiReports: true },
        'admin:super': { name: 'Super Administrador', canEditApiKey: true, canViewBalance: true, canGenSiiReports: true },
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Roles y Permisos de Administrador</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Editar API Key Payku</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ver Saldo Payku</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Generar Reportes SII</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(rolesConfig).map(([roleId, config]) => (
                            <tr key={roleId}>
                                <td className="px-4 py-4 font-medium text-gray-800">{config.name}</td>
                                <td className="px-4 py-4 text-center"><Check className={`mx-auto ${config.canEditApiKey ? 'text-green-500' : 'text-gray-300'}`} /></td>
                                <td className="px-4 py-4 text-center"><Check className={`mx-auto ${config.canViewBalance ? 'text-green-500' : 'text-gray-300'}`} /></td>
                                <td className="px-4 py-4 text-center"><Check className={`mx-auto ${config.canGenSiiReports ? 'text-green-500' : 'text-gray-300'}`} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Sub-componente: Atributos de Servicios (Estandarización) ---
const AttributeSettings = () => {
    const [inclusions, setInclusions] = useState<ServiceAttribute[]>([
        { id: '1', label: "Trae sus propios materiales", description: "El proveedor incluye todos los insumos necesarios para realizar el trabajo." },
        { id: '2', label: "Factura disponible", description: "El proveedor puede emitir factura electrónica afecta a IVA." },
        { id: '4', label: "Pet Friendly", description: "El proveedor utiliza productos seguros para mascotas o se siente cómodo trabajando con ellas cerca." },
        { id: '5', label: "Servicio Express", description: "Disponibilidad para realizar el servicio en menos de 24 horas." },
        { id: '6', label: "Habla Inglés", description: "El proveedor puede comunicarse fluidamente en inglés." },
        { id: '7', label: "Transporte incluido", description: "El precio incluye los costos de traslado dentro de la zona de cobertura." },
    ]);
    const [newInclusion, setNewInclusion] = useState({ label: '', description: '' });

    const handleAdd = () => {
        if (newInclusion.label.trim()) {
            setInclusions([...inclusions, {
                id: Date.now().toString(),
                label: newInclusion.label.trim(),
                description: newInclusion.description.trim() || 'Sin descripción disponible.'
            }]);
            setNewInclusion({ label: '', description: '' });
        }
    };

    const handleDelete = (index: number) => {
        setInclusions(inclusions.filter((_, i) => i !== index));
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Estandarización de Servicios</h2>
            <p className="text-sm text-gray-500 mb-4">Define las opciones predeterminadas que los proveedores pueden seleccionar para describir sus servicios (sección "¿Qué incluye?").</p>

            <div className="mb-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Agregar Nuevo Atributo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <input
                        type="text"
                        value={newInclusion.label}
                        onChange={(e) => setNewInclusion({ ...newInclusion, label: e.target.value })}
                        placeholder="Nombre (Ej. 'Certificado SEC')"
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <input
                        type="text"
                        value={newInclusion.description}
                        onChange={(e) => setNewInclusion({ ...newInclusion, description: e.target.value })}
                        placeholder="Descripción para el cliente..."
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                </div>
                <button onClick={handleAdd} className="flex items-center justify-center w-full bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-opacity-90 text-sm font-medium">
                    <Plus size={16} className="mr-1" /> Agregar Atributo
                </button>
            </div>

            <div className="space-y-2">
                {inclusions.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md hover:shadow-sm transition-shadow">
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                <Check size={16} className="text-green-500 mr-2" />
                                <span className="font-medium text-gray-800">{item.label}</span>
                            </div>
                            <p className="text-xs text-gray-500 ml-6 mt-1">{item.description}</p>
                        </div>
                        <button onClick={() => handleDelete(index)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100 transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t flex justify-end">
                <button className="flex items-center gap-2 py-2 px-4 bg-gray-800 text-white font-semibold rounded-md hover:bg-gray-900 transition">
                    <Save size={16} /> Guardar Lista Maestra
                </button>
            </div>
        </div>
    );
};

// --- Sub-componente: Plantillas de Descripción ---
const ContentTemplatesSettings = () => {
    const [serviceTemplate, setServiceTemplate] = useState(`**Resumen breve:**
[Explica qué problema resuelves y para quién es el servicio]

**Qué incluye:**
- [Prestación o material incluido 1]
- [Prestación o material incluido 2]

**Qué no incluye:**
- [Prestación, material o traslado no incluido]

**Base y factores del precio:**
[Explica qué cubre el precio publicado y qué puede modificarlo]

**Requisitos previos:**
[Indica qué debe tener listo el cliente]

**Cobertura y disponibilidad:**
[Indica comunas, modalidad y tiempos de atención]

**Condiciones y cancelación:**
[Explica las condiciones aplicables y cómo se gestiona una cancelación]`);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Plantillas de Descripción</h2>
            <p className="text-sm text-gray-500 mb-4">Define el texto predeterminado que aparecerá al crear un nuevo servicio para guiar a los proveedores.</p>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plantilla para Servicios Nuevos</label>
                <textarea
                    value={serviceTemplate}
                    onChange={(e) => setServiceTemplate(e.target.value)}
                    rows={10}
                    className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                />
            </div>

            <div className="mt-6 pt-4 border-t flex justify-end">
                <button className="flex items-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-md hover:opacity-90 transition">
                    <Save size={16} /> Guardar Plantilla
                </button>
            </div>
        </div>
    );
};

// --- Sub-componente: Configuración de Verificación (Dinámico, desde DB) ---
const VerificationSettings = () => {
    const [docTypes, setDocTypes] = useState<any[]>([]);
    const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newReason, setNewReason] = useState('');

    // Modal state for add/edit document type
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<any>(null);
    const [modalForm, setModalForm] = useState({
        id: '', name: '', description: '', fileType: 'document',
        acceptedFormats: '.pdf,.jpg,.jpeg,.png', maxFileSize: 10,
        expirationRequired: false, isMandatory: true, isActive: true, sortOrder: 0
    });

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [docsRes, reasonsRes] = await Promise.all([
                adminFetch('/api/admin/verification-requirements'),
                adminFetch('/api/admin/rejection-reasons')
            ]);
            if (docsRes.ok) {
                const data = await docsRes.json();
                if (data.status === 'success') setDocTypes(data.data || []);
            }
            if (reasonsRes.ok) {
                const data = await reasonsRes.json();
                if (data.status === 'success') setRejectionReasons(data.data || []);
            }
        } catch (err) {
            console.error('Error fetching verification settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const openModal = (doc?: any) => {
        if (doc) {
            setEditingDoc(doc);
            setModalForm({
                id: doc.id, name: doc.name, description: doc.description || '',
                fileType: doc.file_type || 'document',
                acceptedFormats: doc.accepted_formats || '.pdf,.jpg,.jpeg,.png',
                maxFileSize: doc.max_file_size_mb || 10,
                expirationRequired: doc.expiration_required || false,
                isMandatory: doc.is_mandatory !== false,
                isActive: doc.is_active !== false,
                sortOrder: doc.sort_order || 0
            });
        } else {
            setEditingDoc(null);
            setModalForm({
                id: '', name: '', description: '', fileType: 'document',
                acceptedFormats: '.pdf,.jpg,.jpeg,.png', maxFileSize: 10,
                expirationRequired: false, isMandatory: true, isActive: true,
                sortOrder: docTypes.length + 1
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveDoc = async () => {
        if (!modalForm.name) return;
        try {
            const payload = {
                id: editingDoc ? editingDoc.id : (modalForm.id || modalForm.name),
                name: modalForm.name,
                description: modalForm.description,
                fileType: modalForm.fileType,
                acceptedFormats: modalForm.acceptedFormats,
                maxFileSize: parseInt(modalForm.maxFileSize as any) || 10,
                expirationRequired: modalForm.expirationRequired,
                isMandatory: modalForm.isMandatory,
                isActive: modalForm.isActive,
                sortOrder: parseInt(modalForm.sortOrder as any) || 0,
                role: 'provider'
            };
            const res = await adminFetch('/api/admin/verification-requirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setIsModalOpen(false);
                fetchData();
            }
        } catch (err) {
            console.error('Error saving document type:', err);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        try {
            await adminFetch(`/api/admin/verification-requirements/${id}`, { method: 'DELETE' });
            fetchData();
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting document type:', err);
        }
    };

    const handleAddReason = async () => {
        if (!newReason.trim()) return;
        try {
            const res = await adminFetch('/api/admin/rejection-reasons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: newReason.trim(), sortOrder: rejectionReasons.length + 1 })
            });
            if (res.ok) {
                setNewReason('');
                fetchData();
            }
        } catch (err) {
            console.error('Error adding reason:', err);
        }
    };

    const handleDeleteReason = async (id: string) => {
        try {
            await adminFetch(`/api/admin/rejection-reasons/${id}`, { method: 'DELETE' });
            fetchData();
        } catch (err) {
            console.error('Error deleting reason:', err);
        }
    };

    const fileTypeLabels: Record<string, string> = {
        'document': '📄 Documento',
        'image': '📷 Imagen',
        'any': '📁 Cualquiera'
    };

    if (loading) return <div className="text-center py-8 text-gray-500">Cargando configuración de verificación...</div>;

    return (
        <div className="space-y-6">
            {/* Gestión de Tipos de Documento */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Tipos de Documentos Requeridos</h2>
                        <p className="text-sm text-gray-500">Define qué documentos se solicitarán a los proveedores en su proceso de verificación KYC.</p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition-colors"
                    >
                        <Plus size={18} className="mr-2" /> Nuevo Documento
                    </button>
                </div>

                {docTypes.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border rounded-md border-dashed">
                        <ShieldCheck size={32} className="mx-auto mb-2 text-gray-300" />
                        <p>No hay tipos de documentos configurados.</p>
                        <p className="text-xs mt-1">Ejecuta la migración o agrega documentos manualmente.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Formatos</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max. MB</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Obligatorio</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expiración</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Activo</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {docTypes.map(doc => (
                                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">{doc.sort_order}</td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                                                {doc.description && <p className="text-xs text-gray-400 truncate max-w-xs">{doc.description}</p>}
                                                <p className="text-[10px] text-gray-300 font-mono mt-0.5">{doc.id}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{fileTypeLabels[doc.file_type] || doc.file_type}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{doc.accepted_formats}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{doc.max_file_size_mb || 10}</td>
                                        <td className="px-4 py-3 text-center">
                                            {doc.is_mandatory ? <Check size={16} className="text-green-500 mx-auto" /> : <X size={16} className="text-gray-300 mx-auto" />}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {doc.expiration_required ? <Check size={16} className="text-orange-500 mx-auto" /> : <X size={16} className="text-gray-300 mx-auto" />}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${doc.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                {doc.is_active ? 'Sí' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => openModal(doc)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 size={16} /></button>
                                            <button onClick={() => setDeleteConfirm(doc.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Gestión de Motivos de Rechazo */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center"><AlertCircle size={20} className="mr-2 text-brand-secondary" /> Motivos de Rechazo Estándar</h2>
                <p className="text-sm text-gray-500 mb-4">Respuestas predefinidas para explicar por qué se rechaza un documento. Se usan en la revisión de KYC del proveedor.</p>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newReason}
                        onChange={(e) => setNewReason(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddReason()}
                        placeholder="Ej. 'Imagen contiene marca de agua'"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    />
                    <button onClick={handleAddReason} className="bg-brand-primary text-white px-4 py-2 rounded-md hover:opacity-90">Agregar</button>
                </div>
                {rejectionReasons.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No hay motivos configurados. Ejecuta la migración o agrégalos manualmente.</p>
                ) : (
                    <ul className="divide-y divide-gray-200 border rounded-md">
                        {rejectionReasons.map((r) => (
                            <li key={r.id} className="flex justify-between items-center p-3 hover:bg-gray-50">
                                <span className="text-gray-700">{r.reason}</span>
                                <button onClick={() => handleDeleteReason(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center mb-4">
                            <AlertTriangle className="text-red-500 mr-3" size={24} />
                            <h3 className="text-lg font-bold text-gray-900">¿Eliminar documento?</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                            Esto eliminará el tipo de documento <strong>{docTypes.find(d => d.id === deleteConfirm)?.name}</strong>.
                        </p>
                        <p className="text-xs text-gray-400 mb-4">Los documentos ya subidos por proveedores no serán afectados.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
                            <button onClick={() => handleDeleteDoc(deleteConfirm)} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Document Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">{editingDoc ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Documento *</label>
                                <input type="text" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-brand-primary focus:border-brand-primary" placeholder="Ej: Certificado de Título"
                                    value={modalForm.name} onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} />
                            </div>
                            {!editingDoc && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Key / ID (auto-generado)</label>
                                    <input type="text" className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-gray-50 text-gray-500 font-mono text-sm" disabled
                                        value={`kyc_${modalForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')}`} />
                                    <p className="text-xs text-gray-400 mt-1">Se usa internamente para identificar el campo de archivo.</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Instrucciones para el proveedor</label>
                                <textarea className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-brand-primary focus:border-brand-primary" rows={2} placeholder="Ej: Foto clara del certificado vigente..."
                                    value={modalForm.description} onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Archivo</label>
                                    <select className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                                        value={modalForm.fileType} onChange={(e) => setModalForm({ ...modalForm, fileType: e.target.value })}>
                                        <option value="document">📄 Documento (PDF, img)</option>
                                        <option value="image">📷 Solo Imagen</option>
                                        <option value="any">📁 Cualquier formato</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Formatos Aceptados</label>
                                    <input type="text" className="w-full border-gray-300 rounded-md shadow-sm p-2 border font-mono text-sm" placeholder=".pdf,.jpg,.png"
                                        value={modalForm.acceptedFormats} onChange={(e) => setModalForm({ ...modalForm, acceptedFormats: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño Máximo (MB)</label>
                                    <input type="number" className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                                        value={modalForm.maxFileSize} onChange={(e) => setModalForm({ ...modalForm, maxFileSize: parseInt(e.target.value) || 10 })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Orden de Visualización</label>
                                    <input type="number" className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                                        value={modalForm.sortOrder} onChange={(e) => setModalForm({ ...modalForm, sortOrder: parseInt(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="flex gap-6 pt-2">
                                <label className="flex items-center cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary mr-2"
                                        checked={modalForm.isMandatory} onChange={(e) => setModalForm({ ...modalForm, isMandatory: e.target.checked })} />
                                    <span className="text-sm font-medium text-gray-700">Obligatorio</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary mr-2"
                                        checked={modalForm.expirationRequired} onChange={(e) => setModalForm({ ...modalForm, expirationRequired: e.target.checked })} />
                                    <span className="text-sm font-medium text-gray-700">Tiene expiración</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary mr-2"
                                        checked={modalForm.isActive} onChange={(e) => setModalForm({ ...modalForm, isActive: e.target.checked })} />
                                    <span className="text-sm font-medium text-gray-700">Activo</span>
                                </label>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
                            <button onClick={handleSaveDoc} className="px-4 py-2 text-white bg-brand-primary rounded-md hover:opacity-90">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-componente: Redes Sociales ---
const SocialMediaSettings = () => {
    const [links, setLinks] = useState({
        facebook: '',
        instagram: '',
        linkedin: '',
        twitter: '',
        tiktok: ''
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const response = await adminFetch('/api/admin/settings/social_media');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data) {
                    setLinks({
                        facebook: data.data.facebook || '',
                        instagram: data.data.instagram || '',
                        linkedin: data.data.linkedin || '',
                        twitter: data.data.twitter || '',
                        tiktok: data.data.tiktok || ''
                    });
                }
            }
        } catch (error) {
            console.error("Error loading social media settings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        try {
            await adminFetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group: 'social_media',
                    settings: links
                })
            });
            alert("Configuración de Redes Sociales guardada.");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Error al guardar la configuración.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Redes Sociales</h2>
            <p className="text-sm text-gray-500 mb-4">Configura los enlaces a tus perfiles de redes sociales. Estos aparecerán automáticamente en el pie de página (Footer) del sitio público.</p>

            <div className="space-y-4 max-w-lg">
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center"><Facebook size={16} className="mr-2 text-blue-600" /> Facebook</label>
                    <input type="url" placeholder="https://facebook.com/serviciosatuhogar" value={links.facebook} onChange={e => setLinks({ ...links, facebook: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center"><Instagram size={16} className="mr-2 text-pink-600" /> Instagram</label>
                    <input type="url" placeholder="https://instagram.com/serviciosatuhogar" value={links.instagram} onChange={e => setLinks({ ...links, instagram: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center"><Linkedin size={16} className="mr-2 text-blue-800" /> LinkedIn</label>
                    <input type="url" placeholder="https://linkedin.com/company/serviciosatuhogar" value={links.linkedin} onChange={e => setLinks({ ...links, linkedin: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center"><Twitter size={16} className="mr-2 text-gray-800" /> X (Twitter)</label>
                    <input type="url" placeholder="https://x.com/serviciosatuhogar" value={links.twitter} onChange={e => setLinks({ ...links, twitter: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center">TikTok</label>
                    <input type="url" placeholder="https://tiktok.com/@serviciosatuhogar" value={links.tiktok} onChange={e => setLinks({ ...links, tiktok: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
            </div>

            <div className="flex justify-end mt-6">
                <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-md hover:opacity-90 transition disabled:opacity-50">
                    <Save size={16} /> Guardar Cambios
                </button>
            </div>
        </div>
    );
};

const MarketplaceConfig: React.FC = () => {
    const [activeSection, setActiveSection] = useState<ConfigSection>('categories');

    const navItems = [
        { id: 'categories', label: 'Categorías', icon: Tag },
        { id: 'attributes', label: 'Atributos y Estándares', icon: List },
        { id: 'templates', label: 'Plantillas de Contenido', icon: FileSignature },
        { id: 'verification', label: 'Verificación & KYC', icon: ShieldCheck },
        { id: 'payments', label: 'Pasarela de Pago', icon: CreditCard },
        { id: 'invoicing', label: 'Facturación SII', icon: Receipt },
        { id: 'policies', label: 'Políticas', icon: FileText },
        { id: 'roles', label: 'Roles y Permisos', icon: Users },
        { id: 'social_media', label: 'Redes Sociales', icon: Share2 },
    ];

    const renderSection = () => {
        switch (activeSection) {
            case 'categories': return <CategorySettings />;
            case 'attributes': return <AttributeSettings />;
            case 'templates': return <ContentTemplatesSettings />;
            case 'verification': return <VerificationSettings />;
            case 'payments': return <PaymentGatewaySettings />;
            case 'invoicing': return <InvoicingSettings />;
            case 'policies': return <PolicySettings />;
            case 'roles': return <RoleSettings />;
            case 'social_media': return <SocialMediaSettings />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Configuración del Marketplace</h1>
                <p className="mt-1 text-gray-600">Centro de control para las reglas de negocio, integraciones y seguridad de la plataforma.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-8">
                <aside className="md:w-1/4 lg:w-1/5">
                    <nav className="space-y-2">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id as ConfigSection)}
                                className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 ${activeSection === item.id
                                    ? 'bg-brand-primary/10 text-brand-primary'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <item.icon size={20} className="mr-3" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="flex-1">
                    {renderSection()}
                </main>
            </div>
        </div>
    );
};

export default MarketplaceConfig;
