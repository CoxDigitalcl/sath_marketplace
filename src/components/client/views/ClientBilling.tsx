import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Building, Download, Save, Loader2, AlertCircle, FileText } from 'lucide-react';
import { api } from '../../../api/client';

interface BillingInfo {
    billingType: 'person' | 'company';
    rut: string;
    fullName: string;
    companyName: string;
    companyBusiness: string;
    address: string;
    city: string;
}

interface Invoice {
    id: string;
    bookingId: string;
    serviceName: string;
    date: string;
    amount: number;
}

const ClientBilling: React.FC = () => {
    const [billingInfo, setBillingInfo] = useState<BillingInfo>({
        billingType: 'person',
        rut: '',
        fullName: '',
        companyName: '',
        companyBusiness: '',
        address: '',
        city: ''
    });
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [billingRes, invoicesRes] = await Promise.all([
                api.get('/billing'),
                api.get('/billing/invoices')
            ]);

            if (billingRes.data.status === 'success') {
                setBillingInfo(billingRes.data.billingInfo);
            }
            if (invoicesRes.data.status === 'success') {
                setInvoices(invoicesRes.data.invoices || []);
            }
        } catch (err: any) {
            console.error('Error fetching billing:', err);
            setError(err.response?.data?.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccessMsg(null);

            await api.put('/billing', {
                billing_type: billingInfo.billingType,
                rut: billingInfo.rut,
                full_name: billingInfo.fullName,
                company_name: billingInfo.companyName,
                company_business: billingInfo.companyBusiness,
                address: billingInfo.address,
                city: billingInfo.city
            });

            setSuccessMsg('Información guardada correctamente');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Datos de Facturación</h1>
                    <p className="mt-1 text-gray-600">Administra tu información para la emisión de facturas y boletas.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Loader2 className="h-12 w-12 text-gray-300 mx-auto animate-spin" />
                    <p className="mt-4 text-gray-500">Cargando datos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Datos de Facturación</h1>
                <p className="mt-1 text-gray-600">Administra tu información para la emisión de facturas y boletas.</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md text-sm">
                    {successMsg}
                </div>
            )}

            {/* Billing Information Form */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setBillingInfo({ ...billingInfo, billingType: 'person' })}
                        className="relative flex items-center gap-2 py-3 px-4 text-sm font-medium"
                    >
                        <User size={16} className={billingInfo.billingType === 'person' ? 'text-brand-primary' : 'text-gray-500'} />
                        <span className={billingInfo.billingType === 'person' ? 'text-gray-900' : 'text-gray-500'}>Persona Natural</span>
                        {billingInfo.billingType === 'person' && <motion.div layoutId="billing-tab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-brand-primary" />}
                    </button>
                    <button
                        onClick={() => setBillingInfo({ ...billingInfo, billingType: 'company' })}
                        className="relative flex items-center gap-2 py-3 px-4 text-sm font-medium"
                    >
                        <Building size={16} className={billingInfo.billingType === 'company' ? 'text-brand-primary' : 'text-gray-500'} />
                        <span className={billingInfo.billingType === 'company' ? 'text-gray-900' : 'text-gray-500'}>Empresa</span>
                        {billingInfo.billingType === 'company' && <motion.div layoutId="billing-tab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-brand-primary" />}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {billingInfo.billingType === 'person' ? (
                        <>
                            <div>
                                <label htmlFor="person_rut" className="block text-sm font-medium text-gray-700">RUT</label>
                                <input
                                    type="text"
                                    id="person_rut"
                                    value={billingInfo.rut}
                                    onChange={(e) => setBillingInfo({ ...billingInfo, rut: e.target.value })}
                                    placeholder="12.345.678-9"
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="person_name" className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                <input
                                    type="text"
                                    id="person_name"
                                    value={billingInfo.fullName}
                                    onChange={(e) => setBillingInfo({ ...billingInfo, fullName: e.target.value })}
                                    placeholder="Juan Pérez González"
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label htmlFor="company_rut" className="block text-sm font-medium text-gray-700">RUT Empresa</label>
                                <input
                                    type="text"
                                    id="company_rut"
                                    value={billingInfo.rut}
                                    onChange={(e) => setBillingInfo({ ...billingInfo, rut: e.target.value })}
                                    placeholder="76.123.456-K"
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">Razón Social</label>
                                <input
                                    type="text"
                                    id="company_name"
                                    value={billingInfo.companyName}
                                    onChange={(e) => setBillingInfo({ ...billingInfo, companyName: e.target.value })}
                                    placeholder="Empresa Ejemplo SpA"
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="company_business" className="block text-sm font-medium text-gray-700">Giro</label>
                                <input
                                    type="text"
                                    id="company_business"
                                    value={billingInfo.companyBusiness}
                                    onChange={(e) => setBillingInfo({ ...billingInfo, companyBusiness: e.target.value })}
                                    placeholder="Servicios Informáticos"
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-md hover:bg-orange-600 transition disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Guardando...' : 'Guardar Información'}
                    </button>
                </div>
            </div>

            {/* Invoices History */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Historial de Boletas/Facturas</h3>
                </div>
                {invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Documento</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {invoices.map(invoice => (
                                    <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-mono text-sm text-gray-600">{invoice.id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-800">{invoice.serviceName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(invoice.date)}</td>
                                        <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(invoice.amount)}</td>
                                        <td className="px-6 py-4">
                                            <button className="flex items-center gap-2 text-sm font-medium text-brand-primary hover:text-orange-600">
                                                <Download size={16} /> Descargar PDF
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto" />
                        <p className="mt-4 text-gray-500">No tienes documentos emitidos aún</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientBilling;
