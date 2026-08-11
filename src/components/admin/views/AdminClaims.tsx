import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {


    AlertTriangle, Send, Loader2, AlertCircle, ChevronLeft, Clock,
    User, Filter, CheckCircle, ThumbsUp, ThumbsDown, MessageCircle,
    DollarSign, FileText
} from 'lucide-react';

// Helper: Authenticated fetch for admin endpoints
const adminFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
};


interface Claim {
    id: string;
    claimNumber: string;
    clientEmail: string;
    clientName: string;
    serviceName: string;
    providerName: string;
    reason: string;
    amount: number;
    status: string;
    resolution: string | null;
    deadline: string | null;
    messageCount: number;
    createdAt: string;
}

interface ClaimMessage {
    id: string;
    senderId: string;
    senderEmail: string;
    senderRole: string;
    message: string;
    attachmentUrl: string | null;
    createdAt: string;
}

interface ClaimDetail {
    id: string;
    claimNumber: string;
    bookingId: string;
    serviceName: string;
    providerName: string;
    clientEmail: string;
    reason: string;
    description: string;
    amount: number;
    status: string;
    resolution: string | null;
    deadline: string | null;
    createdAt: string;
    updatedAt: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: { [key: string]: string } = {
        'Abierto': 'bg-yellow-100 text-yellow-800',
        'En Revisión': 'bg-blue-100 text-blue-800',
        'Resuelto': 'bg-green-100 text-green-800',
        'Cerrado': 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
};

const ResolutionBadge: React.FC<{ resolution: string | null }> = ({ resolution }) => {
    if (!resolution) return null;
    const isClientFavor = resolution === 'client_favor';
    return (
        <span className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${isClientFavor ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
            {isClientFavor ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
            {isClientFavor ? 'A favor del cliente' : 'A favor del proveedor'}
        </span>
    );
};

// Resolve Claim Modal
const ResolveModal: React.FC<{
    claim: ClaimDetail;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ claim, onClose, onSuccess }) => {
    const [resolution, setResolution] = useState<'client_favor' | 'provider_favor'>('client_favor');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        setSubmitting(true);

        try {
            const response = await adminFetch(`/api/admin/claims/${claim.id}/resolve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution, message })
            });

            const result = await response.json();
            if (result.status === 'success') {
                onSuccess();
                onClose();
            } else {
                setError(result.message || 'Error al resolver reclamo');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            >
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Resolver Reclamo</h3>
                    <p className="text-sm text-gray-500 mt-1">{claim.claimNumber}</p>
                </div>
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600"><strong>Monto reclamado:</strong> ${claim.amount.toLocaleString('es-CL')}</p>
                        <p className="text-sm text-gray-600"><strong>Motivo:</strong> {claim.reason}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Resolución *</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setResolution('client_favor')}
                                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition ${resolution === 'client_favor' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <ThumbsUp size={24} className={resolution === 'client_favor' ? 'text-green-600' : 'text-gray-400'} />
                                <span className={`text-sm font-medium ${resolution === 'client_favor' ? 'text-green-700' : 'text-gray-600'}`}>
                                    A favor del Cliente
                                </span>
                                <span className="text-xs text-gray-500">Reembolso/Compensación</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setResolution('provider_favor')}
                                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition ${resolution === 'provider_favor' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <ThumbsDown size={24} className={resolution === 'provider_favor' ? 'text-purple-600' : 'text-gray-400'} />
                                <span className={`text-sm font-medium ${resolution === 'provider_favor' ? 'text-purple-700' : 'text-gray-600'}`}>
                                    A favor del Proveedor
                                </span>
                                <span className="text-xs text-gray-500">Sin compensación</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mensaje de Resolución <span className="text-gray-400 text-xs">- Opcional</span>
                        </label>
                        <textarea
                            rows={3}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            placeholder="Explica la decisión tomada..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </div>
                <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting && <Loader2 size={16} className="animate-spin" />}
                        Confirmar Resolución
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Claim Detail View with Chat
const ClaimDetailView: React.FC<{
    claimId: string;
    onBack: () => void;
}> = ({ claimId, onBack }) => {
    const [claim, setClaim] = useState<ClaimDetail | null>(null);
    const [messages, setMessages] = useState<ClaimMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [showResolveModal, setShowResolveModal] = useState(false);

    const fetchClaimDetail = async () => {
        try {
            const response = await adminFetch(`/api/claims/${claimId}`);
            const result = await response.json();
            if (result.status === 'success') {
                setClaim(result.claim);
                setMessages(result.messages || []);
            }
        } catch (err) {
            setError('Error al cargar reclamo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClaimDetail();
    }, [claimId]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        setSending(true);

        try {
            const response = await adminFetch(`/api/claims/${claimId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage })
            });

            const result = await response.json();
            if (result.status === 'success') {
                setNewMessage('');
                fetchClaimDetail(); // Refresh messages
            }
        } catch (err) {
            console.error('Send message error:', err);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-gray-400" />
            </div>
        );
    }

    if (!claim) {
        return (
            <div className="text-center py-12">
                <AlertCircle size={48} className="mx-auto mb-3 text-red-400" />
                <p className="text-gray-600">{error || 'Reclamo no encontrado'}</p>
                <button onClick={onBack} className="mt-4 text-brand-primary hover:underline">Volver</button>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800">Reclamo {claim.claimNumber}</h2>
                        <p className="text-sm text-gray-500">{claim.reason}</p>
                    </div>
                    <StatusBadge status={claim.status} />
                    {claim.resolution && <ResolutionBadge resolution={claim.resolution} />}
                </div>

                {/* Claim Info */}
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">Cliente:</span>
                        <p className="font-medium">{claim.clientEmail}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Servicio:</span>
                        <p className="font-medium">{claim.serviceName}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Proveedor:</span>
                        <p className="font-medium">{claim.providerName}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Monto:</span>
                        <p className="font-medium text-red-600">${claim.amount.toLocaleString('es-CL')}</p>
                    </div>
                </div>

                {/* Description */}
                <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Descripción del Reclamo</h3>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{claim.description}</p>
                </div>

                {/* Deadline Warning */}
                {claim.deadline && claim.status !== 'Resuelto' && claim.status !== 'Cerrado' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                        <Clock size={20} className="text-amber-600" />
                        <div>
                            <p className="font-medium text-amber-800">Fecha límite de resolución</p>
                            <p className="text-sm text-amber-700">{new Date(claim.deadline).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                )}

                {/* Resolve Button */}
                {claim.status !== 'Resuelto' && claim.status !== 'Cerrado' && (
                    <button
                        onClick={() => setShowResolveModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700"
                    >
                        <CheckCircle size={20} /> Resolver Reclamo
                    </button>
                )}

                {/* Messages */}
                <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold text-gray-800">Historial de Comunicación ({messages.length})</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <p className="text-center text-gray-400 py-8">No hay mensajes en este reclamo</p>
                        )}
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[70%] ${msg.senderRole === 'admin' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-800'} rounded-lg p-3`}>
                                    <p className="text-xs opacity-75 mb-1">
                                        {msg.senderEmail} ({msg.senderRole}) · {new Date(msg.createdAt).toLocaleString('es-CL')}
                                    </p>
                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Reply Input */}
                    {claim.status !== 'Cerrado' && (
                        <div className="p-4 border-t flex gap-3">
                            <input
                                type="text"
                                placeholder="Escribe un mensaje..."
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={sending || !newMessage.trim()}
                                className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Enviar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showResolveModal && claim && (
                    <ResolveModal
                        claim={claim}
                        onClose={() => setShowResolveModal(false)}
                        onSuccess={() => {
                            fetchClaimDetail();
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

// Main Component
const AdminClaims: React.FC = () => {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');

    const fetchClaims = async () => {
        try {
            setLoading(true);
            const url = statusFilter
                ? `/api/admin/claims?status=${encodeURIComponent(statusFilter)}`
                : '/api/admin/claims';
            const response = await adminFetch(url);
            const result = await response.json();
            if (result.status === 'success') {
                setClaims(result.data || []);
            }
        } catch (err) {
            setError('Error al cargar reclamos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClaims();
    }, [statusFilter]);

    if (selectedClaimId) {
        return (
            <ClaimDetailView
                claimId={selectedClaimId}
                onBack={() => {
                    setSelectedClaimId(null);
                    fetchClaims();
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Reclamos de Clientes</h1>
                <p className="mt-1 text-gray-600">Gestiona los reclamos enviados por los clientes y toma decisiones de resolución.</p>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <select
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos los estados</option>
                        <option value="Abierto">Abierto</option>
                        <option value="En Revisión">En Revisión</option>
                        <option value="Resuelto">Resuelto</option>
                        <option value="Cerrado">Cerrado</option>
                    </select>
                </div>
                <span className="text-sm text-gray-500">{claims.length} reclamos</span>
            </div>

            {/* Claims Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-gray-400" />
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
                    <p className="text-red-700">{error}</p>
                </div>
            ) : claims.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                    <AlertTriangle size={48} className="mx-auto mb-3 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-800">No hay reclamos</h3>
                    <p className="text-gray-500 mt-1">No se encontraron reclamos con los filtros actuales.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reclamo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Límite</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensajes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {claims.map(claim => (
                                <tr
                                    key={claim.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setSelectedClaimId(claim.id)}
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-800">{claim.reason}</p>
                                        <p className="text-xs text-gray-500">{claim.claimNumber}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-800">{claim.clientName}</p>
                                        <p className="text-xs text-gray-400">{claim.clientEmail}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-800">{claim.serviceName}</p>
                                        <p className="text-xs text-gray-400">{claim.providerName}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-red-600">${claim.amount.toLocaleString('es-CL')}</td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={claim.status} />
                                        {claim.resolution && (
                                            <div className="mt-1">
                                                <ResolutionBadge resolution={claim.resolution} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {claim.deadline ? new Date(claim.deadline).toLocaleDateString('es-CL') : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-1 text-sm text-gray-600">
                                            <MessageCircle size={14} /> {claim.messageCount}
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
};

export default AdminClaims;
