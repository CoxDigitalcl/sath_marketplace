import React, { useState } from 'react';
import { Order } from '../../../types';
import { ArrowLeft, Check, Clock, AlertTriangle, X, Loader, Banknote, Landmark, FileText, History, Users, ShoppingCart, Info, Code, ShieldX, Undo, Repeat, ShieldCheck } from 'lucide-react';
import { api } from '../../../api/client'; // Import API client
import TransactionStatusBadge from './TransactionStatusBadge';
import toast from 'react-hot-toast';

interface TransactionDetailProps {
    order: Order;
    onBack: () => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
const formatDate = (dateString: string | null) => dateString ? new Date(dateString).toLocaleString('es-CL') : 'N/A';

const TransactionFlowStepper: React.FC<{ status: Order['status'] }> = ({ status }) => {
    const steps = ['Creada', 'Cliente Afilidado', 'Token Generado', 'Pago en Gateway', 'Notificación Recibida', 'Status Verificado', 'Transacción Confirmada'];

    let activeStep = 0;
    if (status === 'PENDING_PAYMENT') activeStep = 3;
    if (status === 'AUTHORIZED') activeStep = 4;
    if (status === 'COMPLETED' || status === 'REFUNDED') activeStep = 6;

    return (
        <div className="w-full">
            <ol className="grid grid-cols-7 text-sm font-medium text-center text-gray-500">
                {steps.map((step, index) => (
                    <li key={step} className={`flex items-center justify-center relative ${index <= activeStep ? 'text-brand-primary' : ''}`}>
                        <div className="flex flex-col items-center">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${index <= activeStep ? 'border-brand-primary bg-brand-primary/10' : 'border-gray-300'}`}>
                                {index < activeStep ? <Check size={16} /> : index + 1}
                            </span>
                            <span className="mt-2 text-xs text-center">{step}</span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`absolute top-4 left-1/2 w-full h-0.5 -translate-x-1/2 ${index < activeStep ? 'bg-brand-primary' : 'bg-gray-300'}`}></div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
};


const TransactionDetail: React.FC<TransactionDetailProps> = ({ order, onBack }) => {
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [showWebhookPayload, setShowWebhookPayload] = useState(false);
    const [showPaykuPayload, setShowPaykuPayload] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);

    const handleReleaseFunds = async () => {
        if (!confirm('¿Liberar los fondos al proveedor? Esta acción confirma que el servicio fue entregado satisfactoriamente y marca la reserva como PAGADA/RELEASED.')) return;

        try {
            setLoadingAction(true);
            const response = await api.put(`/bookings/${localOrder.id}/status`, { status: 'released' });

            if (response.data.status === 'success') {
                // Update local state to reflect change immediately
                setLocalOrder(prev => ({
                    ...prev,
                    raw_status: 'released',
                    // Note: Depending on adminController logic, status might change to COMPLETED
                    // Let's assume frontend enum COMPLETED is appropriate
                    status: 'COMPLETED' as any,
                    payout_status: 'PAYKU_PAID' as any
                }));
                toast.success('Fondos liberados exitosamente. El proveedor recibirá su pago en el próximo ciclo.');
            } else {
                toast.error(response.data.message || 'Error al liberar fondos');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error de conexión');
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900">
                <ArrowLeft size={16} className="mr-2" />
                Volver al listado de transacciones
            </button>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{localOrder.order_number}</h1>
                        <p className="text-sm text-gray-500 font-mono">Payku ID: {localOrder.payku_transaction_id || 'N/A'}</p>
                    </div>
                    <div className="flex-shrink-0">
                        <TransactionStatusBadge status={localOrder.status} type="order" />
                    </div>
                </div>
                <TransactionFlowStepper status={localOrder.status} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Financial Split */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><Banknote size={20} className="mr-2" />Desglose Financiero (Split)</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Total pagado por cliente</span>
                                <span className="font-bold text-lg text-gray-900">{formatCurrency(order.total_clp)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 pl-4">
                                <span className="text-gray-600">Comisión Marketplace ({order.platform_commission_rate * 100}%)</span>
                                <span className="font-medium text-gray-800">{formatCurrency(order.platform_commission_clp)}</span>
                            </div>
                            {order.sii_retention_clp > 0 && (
                                <div className="flex justify-between items-center py-2 pl-4 text-red-600 bg-red-50 rounded-md">
                                    <span className="font-semibold flex items-center"><AlertTriangle size={14} className="mr-2" />Retención SII (19%)</span>
                                    <span className="font-bold">-{formatCurrency(order.sii_retention_clp)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-t pt-4">
                                <span className="text-gray-600 font-bold">Pago a Proveedor</span>
                                <span className="font-bold text-green-600 text-lg">{formatCurrency(order.provider_payout_clp)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Transaction Timeline */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><History size={20} className="mr-2" />Línea de Tiempo</h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-4"><Check size={16} className="text-green-500" /><span className="font-mono text-xs text-gray-500">{formatDate(order.created_at)}</span> <span className="text-sm">Orden creada.</span></li>
                            {order.completed_at && <li className="flex items-center gap-4"><Check size={16} className="text-green-500" /><span className="font-mono text-xs text-gray-500">{formatDate(order.completed_at)}</span> <span className="text-sm">Cliente realizó el pago.</span></li>}
                            {order.webhook_received_at && <li className="flex items-center gap-4"><Check size={16} className="text-green-500" /><span className="font-mono text-xs text-gray-500">{formatDate(order.webhook_received_at)}</span> <span className="text-sm">Webhook de Payku recibido.</span></li>}
                            {order.payout_status === 'PAYKU_SCHEDULED' && <li className="flex items-center gap-4"><Clock size={16} className="text-blue-500" /><span className="font-mono text-xs text-gray-500">{formatDate(order.completed_at)}</span> <span className="text-sm">Payout programado por Payku.</span></li>}
                            {order.payout_status === 'PAYKU_PAID' && <li className="flex items-center gap-4"><Check size={16} className="text-green-500" /><span className="font-mono text-xs text-gray-500">D+1</span> <span className="text-sm">Payout pagado al proveedor.</span></li>}
                            {order.payout_status === 'PAYKU_FAILED' && <li className="flex items-center gap-4"><X size={16} className="text-red-500" /><span className="font-mono text-xs text-gray-500">D+1</span> <span className="text-sm font-semibold text-red-600">Fallo en el Payout.</span></li>}
                        </ul>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><Users size={20} className="mr-2" />Involucrados</h3>
                        <div className="space-y-3 text-sm">
                            <div><span className="font-medium text-gray-500">Cliente:</span> <span className="text-gray-800">{order.customer_name}</span></div>
                            <div><span className="font-medium text-gray-500">Proveedor:</span> <span className="text-gray-800">{order.provider_name}</span></div>
                            <div><span className="font-medium text-gray-500">Servicio:</span> <span className="text-gray-800">{order.service_name}</span></div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><Info size={20} className="mr-2" />Acciones de Admin</h3>
                        <div className="space-y-2">
                            {localOrder.raw_status === 'service_completed' && (
                                <button
                                    onClick={handleReleaseFunds}
                                    disabled={loadingAction}
                                    className="w-full flex items-center text-left py-2 px-3 rounded-md hover:bg-green-50 transition-colors text-green-700 font-semibold border border-green-200 mb-2"
                                >
                                    {loadingAction ? <Loader size={16} className="mr-3 animate-spin" /> : <ShieldCheck size={16} className="mr-3" />}
                                    <span className="text-sm">Liberar Fondos al Proveedor</span>
                                </button>
                            )}
                            <button className="w-full flex items-center text-left py-2 px-3 rounded-md hover:bg-gray-100 transition-colors text-red-600">
                                <ShieldX size={16} className="mr-3" /> <span className="text-sm font-medium">Iniciar Reembolso Total</span>
                            </button>
                            <button className="w-full flex items-center text-left py-2 px-3 rounded-md hover:bg-gray-100 transition-colors text-orange-600">
                                <Undo size={16} className="mr-3" /> <span className="text-sm font-medium">Iniciar Reembolso Parcial</span>
                            </button>
                            <button className="w-full flex items-center text-left py-2 px-3 rounded-md hover:bg-gray-100 transition-colors text-blue-600">
                                <Repeat size={16} className="mr-3" /> <span className="text-sm font-medium">Re-enviar Webhook (Debug)</span>
                            </button>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><Code size={20} className="mr-2" />Info Desarrollador</h3>
                        <div className="space-y-2">
                            <button onClick={() => setShowPaykuPayload(!showPaykuPayload)} className="font-medium text-sm text-brand-primary w-full text-left">Ver Payload de Payku</button>
                            {showPaykuPayload && <pre className="bg-gray-800 text-white p-3 rounded-md text-xs overflow-x-auto"><code>{JSON.stringify({ order_id: order.order_number, amount: order.total_clp, affiliate_id: 'aff_123abc', split: { marketplace: { amount: order.platform_commission_clp + order.sii_retention_clp }, affiliate: { amount: order.provider_payout_clp } } }, null, 2)}</code></pre>}
                            <button onClick={() => setShowWebhookPayload(!showWebhookPayload)} className="font-medium text-sm text-brand-primary w-full text-left">Ver Webhook Recibido</button>
                            {showWebhookPayload && <pre className="bg-gray-800 text-white p-3 rounded-md text-xs overflow-x-auto"><code>{JSON.stringify({ event: "transaction.completed", data: { id: order.payku_transaction_id, order_id: order.order_number, status: 'completed' } }, null, 2)}</code></pre>}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TransactionDetail;