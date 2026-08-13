
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AdminView } from '../AdminDashboard';
import { Shield, MessageCircle, StarOff, AlertOctagon, MoreVertical, Eye, Check, X, Pause, Download, Image as ImageIcon, User, FileImage } from 'lucide-react';
import { ServiceReport, ReportReason, ReportStatus, ReportedReview, Dispute, DisputeStatus, PendingImage, ImageModerationStatus } from '../../../types';
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




type ModerationTab = 'services' | 'reviews' | 'disputes' | 'images';

interface ContentModerationProps {
    setActiveView: (view: AdminView) => void;
}

const ContentModeration: React.FC<ContentModerationProps> = ({ setActiveView }) => {
    const [activeTab, setActiveTab] = useState<ModerationTab>('images');

    // State for real data
    const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
    const [reportedReviews, setReportedReviews] = useState<ReportedReview[]>([]);
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchModerationData = async () => {
            try {
                // Removed Auth header as per direct access change
                const response = await adminFetch('/api/admin/moderation');
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success') {
                        // Correctly assign data with fallback to empty arrays
                        setDisputes(result.data.disputes || []);
                        setPendingImages(result.data.images || []);
                        setServiceReports(result.data.services || []);
                        setReportedReviews(result.data.reviews || []);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch moderation data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchModerationData();
    }, []);

    const handleResolveImage = async (providerId: string, imageType: string, status: 'approved' | 'rejected', reason?: string) => {
        try {
            const token = JSON.parse(sessionStorage.getItem('auth-storage') || '{}').state?.token;
            const res = await adminFetch(`/api/admin/moderation/images/${providerId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, reason, type: imageType })
            });
            if (res.ok) {
                // Remove the image from the local state
                setPendingImages(prev => prev.filter(img => !(img.id === providerId && img.type === imageType)));
            } else {
                const data = await res.json();
                toast.error(`Error: ${data.message || 'No se pudo resolver la imagen'}`);
            }
        } catch (error) {
            toast.error("Error al intentar resolver la imagen.");
        }
    };

    // Stats calculation based on real state
    const pendingCounts = useMemo(() => ({
        services: serviceReports.filter(r => r.status === ReportStatus.PENDING_REVIEW).length,
        reviews: reportedReviews.length,
        disputes: disputes.filter(d => d.status !== DisputeStatus.RESOLVED).length,
        images: pendingImages.filter(i => i.status === ImageModerationStatus.PENDING).length,
    }), [serviceReports, reportedReviews, disputes, pendingImages]);

    const TabButton: React.FC<{ tabId: ModerationTab; title: string; icon: React.ElementType; count: number; }> = ({ tabId, title, icon: Icon, count }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tabId
                ? 'border-brand-primary text-brand-primary bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
        >
            <Icon size={18} className="mr-2" />
            <span>{title}</span>
            {count > 0 && <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{count}</span>}
        </button>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'services':
                return (
                    <div className="space-y-4 p-6">
                        {serviceReports.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Shield size={48} className="mx-auto mb-3 text-gray-300" />
                                <p>No hay reportes de servicios pendientes.</p>
                            </div>
                        )}
                        {serviceReports.map(report => (
                            <div key={report.id} className="bg-white border rounded-lg p-4 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-800">{report.serviceName}</span>
                                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">{report.reason}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">Reportado por: <span className="font-medium">{report.reportedBy}</span></p>
                                    <p className="text-sm text-gray-500 italic">"Reporte generado automáticamente"</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200">Ignorar</button>
                                    <button className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Eliminar Servicio</button>
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'reviews':
                return (
                    <div className="space-y-4 p-6">
                        {reportedReviews.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <StarOff size={48} className="mx-auto mb-3 text-gray-300" />
                                <p>No hay reviews reportadas pendientes de moderación.</p>
                            </div>
                        )}
                        {reportedReviews.map(review => (
                            <div key={review.id} className="bg-white border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-800">Review para {review.providerName}</span>
                                            <span className="text-yellow-500 flex items-center text-xs"><StarOff size={12} fill="currentColor" /> {review.rating}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Autor: {review.clientId} (ID)</p>
                                    </div>
                                    <span className="text-xs text-gray-400">Orden: {review.orderId}</span>
                                </div>
                                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded mb-3">"{review.content}"</p>
                                <div className="flex justify-end gap-2">
                                    <button className="text-sm text-gray-600 hover:text-gray-800">Descartar</button>
                                    <button className="text-sm text-red-600 hover:text-red-800 font-medium">Borrar Review</button>
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'disputes':
                return (
                    <div className="space-y-4 p-6">
                        {disputes.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <AlertOctagon size={48} className="mx-auto mb-3 text-gray-300" />
                                <p>No hay disputas activas pendientes de resolución.</p>
                            </div>
                        )}
                        {disputes.map(d => (
                            <div key={d.id} className="bg-white border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-semibold text-gray-800">Disputa {d.id}</h4>
                                        <p className="text-xs text-gray-500">Estado: <span className="font-medium text-orange-600">{d.status}</span></p>
                                    </div>
                                    <span className="text-xs text-gray-400">{d.deadline ? new Date(d.deadline).toLocaleDateString() : 'Sin fecha'}</span>
                                </div>
                                <p className="text-sm text-gray-700 mb-4">{d.reason}</p>
                                <div className="flex gap-2">
                                    <button className="flex-1 text-sm bg-brand-primary text-white py-2 rounded hover:opacity-90">Ver Chat / Evidencia</button>
                                    <button className="flex-1 text-sm border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50">Resolver a favor de Cliente</button>
                                    <button className="flex-1 text-sm border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50">Resolver a favor de Proveedor</button>
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'images':
                return (
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingImages.length === 0 && (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    <ImageIcon size={48} className="mx-auto mb-3 text-gray-300" />
                                    <p>No hay imágenes pendientes de moderación.</p>
                                </div>
                            )}
                            {pendingImages.map(img => (
                                <div key={`${img.id}-${img.type}`} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                    <div className={`relative ${img.type === 'profile' ? 'p-4 bg-gray-50 flex justify-center' : ''}`}>
                                        <img
                                            src={img.imageUrl}
                                            alt={`${img.type} upload`}
                                            className={`object-cover ${img.type === 'profile' ? 'w-32 h-32 rounded-full border-4 border-white shadow-md' : 'w-full h-40'}`}
                                        />
                                        <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded capitalize">
                                            {img.type === 'profile' ? 'Foto Perfil' : 'Banner'}
                                        </span>
                                    </div>
                                    <div className="p-4 flex-grow">
                                        <h4 className="font-bold text-gray-800">{img.providerName}</h4>
                                        <p className="text-xs text-gray-500">Subido: {new Date(img.uploadDate).toLocaleString('es-CL')}</p>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => handleResolveImage(img.id, img.type, 'approved')}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md text-sm font-medium flex items-center justify-center"
                                            >
                                                <Check size={16} className="mr-1" /> Aprobar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const reason = prompt("Motivo del rechazo (ej. Imagen borrosa, contenido inapropiado):");
                                                    if (reason) handleResolveImage(img.id, img.type, 'rejected', reason);
                                                }}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-md text-sm font-medium flex items-center justify-center"
                                            >
                                                <X size={16} className="mr-1" /> Rechazar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Moderación de Contenido</h1>
                <p className="mt-1 text-gray-600">Gestiona reportes, reviews, imágenes y disputas para mantener un marketplace seguro y confiable.</p>
            </div>

            <div className="flex items-center border-b border-gray-200 bg-gray-50 rounded-t-lg overflow-x-auto">
                <TabButton tabId="images" title="Imágenes" icon={FileImage} count={pendingCounts.images} />
                <TabButton tabId="services" title="Reportes de Servicios" icon={Shield} count={pendingCounts.services} />
                <TabButton tabId="reviews" title="Reviews Reportadas" icon={StarOff} count={pendingCounts.reviews} />
                <TabButton tabId="disputes" title="Fila de Disputas" icon={AlertOctagon} count={pendingCounts.disputes} />
                <button
                    onClick={() => setActiveView('tickets')}
                    className="flex items-center px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 whitespace-nowrap ml-auto"
                >
                    <MessageCircle size={18} className="mr-2" />
                    <span>Tickets de Soporte</span>
                </button>
            </div>

            <div className="bg-white rounded-b-lg shadow-sm border border-t-0 border-gray-200">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default ContentModeration;
