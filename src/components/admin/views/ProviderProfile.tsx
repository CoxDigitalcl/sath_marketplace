import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Provider } from './ProviderManagement';
import StatusBadge from '../provider-management/StatusBadge';
import {
    ArrowLeft, AlertTriangle, CheckCircle, XCircle, DollarSign, ShoppingCart, Star, BarChart2,
    Book, ListOrdered, Banknote, FileText, History,
    Flame, UserCog, Ban, Power, PowerOff, ShieldOff, LogIn, KeyRound, Tag, MessageSquare,
    PlusCircle, Edit, MoreVertical, User, Terminal, Server, Eye, X, Check, ChevronDown, ShieldCheck, Clock
} from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';

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




interface ProviderProfileProps {
    provider: Provider;
    onBack: () => void;
}

type Tab = 'summary' | 'catalog' | 'orders' | 'finance' | 'documents' | 'activity';

// REJECTION_REASONS are now loaded dynamically from DB
// Fallback only used if API is down
const FALLBACK_REJECTION_REASONS = [
    "Documento borroso o ilegible",
    "Documento vencido",
    "Nombre no coincide con el perfil",
    "Archivo corrupto o formato no válido",
    "Falta reverso de la cédula",
    "Certificado con antigüedad mayor a 30 días",
    "Otro (Ver comentarios)"
];

const KpiCard: React.FC<{ title: string; value: string; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-md mr-4">
                <Icon className="h-6 w-6 text-gray-600" />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    </div>
);

// Helper Components
const DocumentReviewModal: React.FC<{ document: any; onClose: () => void; onDecision: (id: string, status: string, feedback?: string) => void; rejectionReasons?: string[] }> = ({ document, onClose, onDecision, rejectionReasons }) => {
    const [rejectMode, setRejectMode] = useState(false);
    const [selectedReason, setSelectedReason] = useState('');
    const [comment, setComment] = useState('');
    const [previewError, setPreviewError] = useState(false);
    const [zoomed, setZoomed] = useState(false);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    const handleConfirmReject = () => {
        if (!selectedReason) {
            toast.error('Debes seleccionar un motivo');
            return;
        }
        onDecision(document.id, 'Rechazado', selectedReason + (comment ? `: ${comment}` : ''));
        onClose();
    };

    // Determine file type from URL
    const fileUrl = document.url || '';
    const previewUrl = objectUrl || fileUrl;
    const extension = fileUrl.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
    const isPdf = extension === 'pdf';

    useEffect(() => {
        let nextObjectUrl: string | null = null;
        setPreviewError(false);
        setObjectUrl(null);

        if (!fileUrl.startsWith('/api/files/private/')) return;

        const token = sessionStorage.getItem('auth_token');
        fetch(fileUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(response => {
                if (!response.ok) throw new Error('No se pudo cargar el archivo');
                return response.blob();
            })
            .then(blob => {
                nextObjectUrl = URL.createObjectURL(blob);
                setObjectUrl(nextObjectUrl);
            })
            .catch(() => setPreviewError(true));

        return () => {
            if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
        };
    }, [fileUrl]);

    const renderPreview = () => {
        if (!fileUrl || fileUrl === 'pending_upload') {
            return (
                <div className="text-center">
                    <FileText size={64} className="text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">Documento aún no subido</p>
                </div>
            );
        }

        if (previewError) {
            return (
                <div className="text-center">
                    <AlertTriangle size={64} className="text-yellow-500 mx-auto mb-4" />
                    <p className="text-gray-300 text-lg font-medium">No se pudo cargar la vista previa</p>
                    <p className="text-gray-500 text-sm mt-2 mb-4">El archivo puede no existir en el servidor o ser inaccesible.</p>
                    <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <Eye size={16} /> Intentar abrir en nueva pestaña
                    </a>
                </div>
            );
        }

        if (isImage) {
            return (
                <div className={`w-full h-full flex items-center justify-center ${zoomed ? 'cursor-zoom-out overflow-auto' : 'cursor-zoom-in'}`}>
                    <img
                        src={previewUrl}
                        alt={document.name}
                        className={`transition-transform duration-300 ${zoomed ? 'max-w-none scale-150' : 'max-w-full max-h-full object-contain'}`}
                        onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                        onError={() => setPreviewError(true)}
                    />
                </div>
            );
        }

        if (isPdf) {
            return (
                <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title={document.name}
                    onError={() => setPreviewError(true)}
                />
            );
        }

        // Unknown file type — show download link
        return (
            <div className="text-center">
                <FileText size={64} className="text-gray-500 mx-auto mb-4" />
                <p className="text-gray-300 text-lg font-medium">{document.name}</p>
                <p className="text-gray-500 text-sm mt-1 mb-4">Tipo de archivo: .{extension}</p>
                <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                    <Eye size={16} /> Abrir archivo
                </a>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[80vh]" onClick={e => e.stopPropagation()}>
                {/* Left: Document Preview */}
                <div className="w-full md:w-2/3 bg-gray-900 flex items-center justify-center relative overflow-hidden">
                    {renderPreview()}
                    {/* Open in new tab button (top-right) */}
                    {fileUrl && fileUrl !== 'pending_upload' && (
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/40 backdrop-blur rounded-lg transition-colors"
                            title="Abrir en nueva pestaña"
                        >
                            <Eye size={18} className="text-white" />
                        </a>
                    )}
                </div>
                {/* Right: Controls */}
                <div className="w-full md:w-1/3 flex flex-col border-l border-gray-200">
                    <div className="p-6 border-b flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">{document.name}</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {isImage ? '📷 Imagen' : isPdf ? '📄 PDF' : '📁 Archivo'} — {document.status}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={24} className="text-gray-400" /></button>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto">
                        {!rejectMode ? (
                            <div className="space-y-4">
                                <button onClick={() => { onDecision(document.id, 'Aprobado'); onClose(); }} className="w-full flex items-center justify-center p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors">
                                    <CheckCircle size={20} className="mr-2" /> Aprobar
                                </button>
                                <button onClick={() => setRejectMode(true)} className="w-full flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-red-50 text-red-700 font-medium transition-colors">
                                    <XCircle size={20} className="mr-2" /> Rechazar
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium mb-2">Motivo</label>
                                <select className="w-full p-2 border rounded mb-4" value={selectedReason} onChange={e => setSelectedReason(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {(rejectionReasons || FALLBACK_REJECTION_REASONS).map((r, i) => <option key={i} value={r}>{r}</option>)}
                                </select>
                                <textarea className="w-full p-2 border rounded mb-4" placeholder="Comentario..." value={comment} onChange={e => setComment(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={() => setRejectMode(false)} className="flex-1 py-2 border rounded">Cancelar</button>
                                    <button onClick={handleConfirmReject} className="flex-1 py-2 bg-red-600 text-white rounded">Confirmar</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProviderProfile: React.FC<ProviderProfileProps> = ({ provider, onBack }) => {
    const [activeTab, setActiveTab] = useState<Tab>('summary');
    const [isLoading, setIsLoading] = useState(false);

    // Real Data State
    const [services, setServices] = useState<any[]>([]);
    const [fullDetails, setFullDetails] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [settlementMonth, setSettlementMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [settlementGenerating, setSettlementGenerating] = useState(false);
    const [settlementResult, setSettlementResult] = useState<any>(null);

    // Modals
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<any>(null);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

    const [rejectionReasons, setRejectionReasons] = useState<string[]>(FALLBACK_REJECTION_REASONS);
    const [docNameMap, setDocNameMap] = useState<Record<string, string>>({});

    const handleGenerateMonthlySettlement = async () => {
        if (!settlementMonth) return;
        const [year, month] = settlementMonth.split('-').map(Number);
        setSettlementGenerating(true);
        setSettlementResult(null);

        try {
            const response = await adminFetch(`/api/admin/providers/${provider.id}/monthly-settlement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month })
            });
            const data = await response.json();

            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'No se pudo emitir la liquidacion mensual');
            }

            setSettlementResult(data.settlement);
            toast.success('Liquidacion mensual emitida');
        } catch (err: any) {
            toast.error(err.message || 'Error al emitir liquidacion mensual');
        } finally {
            setSettlementGenerating(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 0. Fetch KYC Requirements for name mapping and rejection reasons
                const [kycReqsRes, reasonsRes] = await Promise.all([
                    adminFetch('/api/admin/verification-requirements').then(r => r.ok ? r.json() : null).catch(() => null),
                    adminFetch('/api/admin/rejection-reasons').then(r => r.ok ? r.json() : null).catch(() => null)
                ]);

                // Build name map from requirements
                const nameMap: Record<string, string> = {};
                if (kycReqsRes?.data) {
                    kycReqsRes.data.forEach((req: any) => {
                        nameMap[req.id] = req.name;
                    });
                }
                setDocNameMap(nameMap);

                // Load rejection reasons
                if (reasonsRes?.data?.length > 0) {
                    const reasons = reasonsRes.data.map((r: any) => r.reason);
                    reasons.push('Otro (Ver comentarios)');
                    setRejectionReasons(reasons);
                }

                // 1. Fetch Full Details (KYC)
                const detailsRes = await api.get(`/admin/providers/${provider.id}`);
                const details = detailsRes.data.data;
                setFullDetails(details);

                // Map KYC Docs using dynamic names
                if (details.kyc_documents) {
                    const mappedDocs = Object.keys(details.kyc_documents).map((key) => {
                        const doc = details.kyc_documents[key];
                        return {
                            id: key,
                            name: nameMap[key] || key.replace(/^kyc_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            status: doc.status === 'pending' ? 'Pendiente' : doc.status === 'approved' ? 'Aprobado' : 'Rechazado',
                            url: doc.url,
                            type: 'file',
                            feedback: ''
                        };
                    });
                    setDocuments(mappedDocs);
                }

                // 2. Fetch Services
                const servicesRes = await api.get(`/admin/providers/${provider.id}/services`);
                setServices(servicesRes.data.data);

            } catch (err) {
                console.error("Error fetching provider details:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [provider.id]);



    const handleDocumentDecision = async (id: string, status: string, feedback?: string) => {
        try {
            // Map UI status to Backend status ('approved' | 'rejected')
            const apiStatus = status === 'Aprobado' ? 'approved' : 'rejected';

            await api.put(`/admin/providers/${provider.id}/documents`, {
                documentId: id,
                status: apiStatus,
                feedback: feedback
            });

            // Optimistic Update
            setDocuments(docs => docs.map(d =>
                d.id === id ? { ...d, status: status, feedback: feedback || '' } : d
            ));

            // Refresh full details to check if is_verified changed
            const detailsRes = await api.get(`/admin/providers/${provider.id}`);
            if (detailsRes.data.data.is_verified) {
                toast.success("¡El proveedor ha sido verificado exitosamente!");
            }
        } catch (err) {
            toast.error("Error al actualizar el documento.");
        }
    };

    const renderTabContent = () => {
        if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando datos del proveedor...</div>;

        switch (activeTab) {
            case 'summary':
                return (
                    <div className="space-y-6">
                        {/* Real Stats from Provider List Prop (usually 0 for now) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="Ingresos (30d)" value={formatCurrency(provider.income30d)} icon={DollarSign} />
                            <KpiCard title="Órdenes (30d)" value={provider.orders30d.toString()} icon={ShoppingCart} />
                            <KpiCard title="Rating" value={provider.rating.toFixed(1)} icon={Star} />
                            <KpiCard title="Cancelación" value={`${(provider.cancellationRate * 100).toFixed(1)}%`} icon={XCircle} />
                        </div>
                        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
                            <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No hay datos suficientes para generar el gráfico de ingresos.</p>
                        </div>
                    </div>
                );
            case 'catalog':
                return (
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-800">Catálogo de Servicios ({services.length})</h3>
                        </div>
                        {services.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Este proveedor no tiene servicios creados.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {services.map(service => (
                                            <tr key={service.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{service.title}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.category}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(service.price)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${service.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {service.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            case 'orders':
                return (
                    <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center">
                        <ListOrdered className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">No hay órdenes registradas.</p>
                        <p className="text-sm text-gray-400">El historial de órdenes aparecerá aquí una vez que el proveedor comience a vender.</p>
                    </div>
                );
            case 'finance':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-50 rounded-lg text-purple-700">
                                <Banknote className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">Liquidacion mensual del proveedor</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Emite el DTE mensual con el resumen de operaciones pagadas del proveedor en la plataforma.
                                </p>
                                <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-end">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
                                        <input
                                            type="month"
                                            value={settlementMonth}
                                            onChange={(e) => setSettlementMonth(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleGenerateMonthlySettlement}
                                        disabled={settlementGenerating || !settlementMonth}
                                        className="inline-flex items-center justify-center px-4 py-2 bg-brand-primary text-white rounded-md font-medium hover:opacity-90 disabled:opacity-50"
                                    >
                                        {settlementGenerating ? 'Emitiendo...' : 'Emitir DTE mensual'}
                                    </button>
                                </div>
                                {settlementResult && (
                                    <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                                        <p className="font-semibold text-green-900">Liquidacion emitida</p>
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-green-800">
                                            <span>Operaciones: {settlementResult.bookings_count}</span>
                                            <span>Monto servicios: {formatCurrency(Number(settlementResult.gross_amount || 0))}</span>
                                            <span>Comision plataforma: {formatCurrency(Number(settlementResult.platform_fee || 0))}</span>
                                        </div>
                                        {settlementResult.dte_url && (
                                            <a href={settlementResult.dte_url} target="_blank" rel="noreferrer" className="inline-flex mt-3 text-green-800 font-medium hover:underline">
                                                Ver DTE emitido
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'documents':
                return (
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center"><ShieldCheck className="mr-2 text-brand-primary" size={20} /> Documentos KYC</h3>

                        {documents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No se han subido documentos de verificación.</div>
                        ) : (
                            <ul className="divide-y divide-gray-200">
                                {documents.map(doc => (
                                    <li key={doc.id} className="py-4 flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className={`p-2 rounded-full mr-4 ${doc.status === 'Aprobado' ? 'bg-green-100 text-green-600' : doc.status === 'Rechazado' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                                {doc.status === 'Aprobado' ? <CheckCircle size={20} /> : doc.status === 'Rechazado' ? <XCircle size={20} /> : <Clock size={20} />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{doc.name}</p>
                                                <p className="text-xs text-gray-500">{doc.status}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedDoc(doc); setReviewModalOpen(true); }}
                                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                            <Eye size={16} className="mr-2 inline" /> Revisar
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            default:
                return <div className="text-center text-gray-500 py-10">Sección en construcción</div>;
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'summary', label: 'Resumen', icon: BarChart2 },
        { id: 'catalog', label: 'Catálogo', icon: Book },
        { id: 'orders', label: 'Órdenes', icon: ListOrdered },
        { id: 'finance', label: 'Finanzas', icon: Banknote },
        { id: 'documents', label: 'Documentos', icon: FileText },
    ];

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900">
                <ArrowLeft size={16} className="mr-2" /> Volver
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center">
                    <img src={provider.avatarUrl} alt={provider.storeName} className="h-16 w-16 rounded-full object-cover mr-4 bg-gray-200" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{provider.storeName}</h1>
                        <p className="text-gray-500">{provider.ownerEmail} {fullDetails?.rut && `| ${fullDetails.rut}`}</p>
                    </div>
                </div>
                <StatusBadge status={provider.status} />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200 px-4">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <tab.icon size={16} className="mr-2" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="p-6 bg-gray-50 min-h-[400px]">
                    {renderTabContent()}
                </div>
            </div>

            {/* Review Modal */}
            <AnimatePresence>
                {reviewModalOpen && selectedDoc && (
                    <DocumentReviewModal
                        document={selectedDoc}
                        onClose={() => setReviewModalOpen(false)}
                        onDecision={handleDocumentDecision}
                        rejectionReasons={rejectionReasons}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProviderProfile;
