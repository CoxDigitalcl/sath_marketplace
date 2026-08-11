import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Paperclip, AlertTriangle, Loader2, AlertCircle, Send, ChevronLeft, MessageCircle, Clock, DollarSign } from 'lucide-react';
import { api } from '../../../api/client';

interface Claim {
    id: string;
    claimNumber: string;
    bookingId: string;
    serviceName: string;
    providerName: string;
    reason: string;
    amount: number;
    status: string;
    resolution: string | null;
    deadline: string;
    createdAt: string;
    messageCount?: number;
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

interface BookingOption {
    id: string;
    label: string;
    amount: number;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: { [key: string]: string } = {
        'Abierto': 'bg-yellow-100 text-yellow-800',
        'En Mediación': 'bg-blue-100 text-blue-800',
        'En Revisión': 'bg-blue-100 text-blue-800',
        'Resuelto': 'bg-green-100 text-green-800',
        'Cerrado': 'bg-gray-100 text-gray-800',
        'Rechazado': 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
};

const Countdown: React.FC<{ to: string }> = ({ to }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const deadline = new Date(to).getTime();
            const now = new Date().getTime();
            const distance = deadline - now;

            if (distance < 0) {
                setTimeLeft('Vencido');
                setIsUrgent(true);
                clearInterval(interval);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

            setTimeLeft(`${days}d ${hours}h ${minutes}m`);
            setIsUrgent(days < 3);

        }, 1000);
        return () => clearInterval(interval);
    }, [to]);

    return <span className={`font-mono text-sm ${isUrgent ? 'font-bold text-red-600' : 'text-gray-700'}`}>{timeLeft}</span>;
};

const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

const CLAIM_REASONS = [
    'Servicio no realizado',
    'Servicio incompleto o defectuoso',
    'Incumplimiento de lo pactado',
    'Cobro indebido',
    'Otro'
];

// New Claim Modal
const NewClaimModal: React.FC<{
    onClose: () => void;
    onSuccess: () => void;
    bookings: BookingOption[];
    preselectedBookingId?: string;
}> = ({ onClose, onSuccess, bookings, preselectedBookingId }) => {
    const [formData, setFormData] = useState({
        booking_id: preselectedBookingId || '',
        reason: '',
        description: ''
    });
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const formPayload = new FormData();
            formPayload.append('booking_id', formData.booking_id);
            formPayload.append('reason', formData.reason);
            formPayload.append('description', formData.description);
            if (file) {
                formPayload.append('attachment', file);
            }

            await api.post('/claims', formPayload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al crear el reclamo');
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
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
            >
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800">Iniciar Nuevo Reclamo</h3>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Orden Afectada *</label>
                                <select
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                    value={formData.booking_id}
                                    onChange={(e) => setFormData({ ...formData, booking_id: e.target.value })}
                                >
                                    <option value="">Selecciona una orden...</option>
                                    {bookings.map(b => (
                                        <option key={b.id} value={b.id}>{b.label}</option>
                                    ))}
                                </select>
                                {bookings.length === 0 && (
                                    <p className="mt-1 text-xs text-gray-500">No tienes órdenes disponibles para reclamar</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Motivo del Reclamo *</label>
                                <select
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                >
                                    <option value="">Selecciona un motivo...</option>
                                    {CLAIM_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Descripción Detallada *</label>
                            <textarea
                                rows={6}
                                required
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                                placeholder="Describe tu problema con el mayor detalle posible..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Adjuntar Evidencia (Opcional)</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="flex text-sm text-gray-600">
                                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-orange-600">
                                            <span>Sube un archivo</span>
                                            <input type="file" className="sr-only" onChange={handleFileChange} />
                                        </label>
                                        <p className="pl-1">o arrastra y suelta</p>
                                    </div>
                                    <p className="text-xs text-gray-500">{file?.name || 'PNG, JPG, PDF hasta 10MB'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || bookings.length === 0}
                            className="bg-brand-primary hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {submitting && <Loader2 size={16} className="animate-spin" />}
                            Enviar Reclamo
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

// Claim Detail View with Chat
const ClaimDetailView: React.FC<{
    claimId: string;
    onBack: () => void;
}> = ({ claimId, onBack }) => {
    const [claim, setClaim] = useState<any>(null);
    const [messages, setMessages] = useState<ClaimMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const fetchClaimDetail = async () => {
        try {
            const res = await api.get(`/claims/${claimId}`);
            if (res.data.status === 'success') {
                setClaim(res.data.claim);
                setMessages(res.data.messages || []);
            }
        } catch (err) {
            console.error('Error fetching claim detail:', err);
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
            await api.post(`/claims/${claimId}/messages`, { message: newMessage });
            setNewMessage('');
            fetchClaimDetail();
        } catch (err) {
            console.error('Error sending message:', err);
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
                <p className="text-gray-600">Reclamo no encontrado</p>
                <button onClick={onBack} className="mt-4 text-brand-primary hover:underline">Volver</button>
            </div>
        );
    }

    const isClosed = claim.status === 'Cerrado' || claim.status === 'Resuelto';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800">Reclamo {claim.claim_number}</h2>
                    <p className="text-sm text-gray-500">{claim.reason}</p>
                </div>
                <StatusBadge status={claim.status} />
            </div>

            {/* Claim Info Card */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">Servicio:</span>
                        <p className="font-medium">{claim.service_name || 'N/A'}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Proveedor:</span>
                        <p className="font-medium">{claim.provider_name || 'N/A'}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Monto:</span>
                        <p className="font-semibold text-orange-600 flex items-center gap-1">
                            <DollarSign size={14} /> {formatCurrency(claim.amount || 0)}
                        </p>
                    </div>
                    <div>
                        <span className="text-gray-500">Fecha Límite:</span>
                        {claim.deadline ? (
                            <p className="font-medium flex items-center gap-1">
                                <Clock size={14} className="text-orange-500" /> <Countdown to={claim.deadline} />
                            </p>
                        ) : (
                            <p className="font-medium">-</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Description */}
            {claim.description && (
                <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Descripción del Reclamo</h3>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{claim.description}</p>
                </div>
            )}

            {/* Resolution Notice */}
            {claim.resolution && (
                <div className={`rounded-lg p-4 border ${claim.resolution === 'client_favor' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
                    <h3 className={`font-semibold ${claim.resolution === 'client_favor' ? 'text-green-800' : 'text-purple-800'}`}>
                        Resolución: {claim.resolution === 'client_favor' ? 'A tu favor' : 'A favor del proveedor'}
                    </h3>
                </div>
            )}

            {/* Messages */}
            <div className="bg-white border rounded-lg">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <MessageCircle size={18} /> Comunicación con Soporte ({messages.length})
                    </h3>
                </div>
                <div className="max-h-80 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No hay mensajes aún. Envía el primero para comunicarte con el equipo de soporte.</p>
                    )}
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderRole === 'admin' ? 'justify-start' : 'justify-end'}`}
                        >
                            <div className={`max-w-[70%] ${msg.senderRole === 'admin' ? 'bg-gray-100 text-gray-800' : 'bg-brand-primary text-white'} rounded-lg p-3`}>
                                <p className="text-xs opacity-75 mb-1">
                                    {msg.senderRole === 'admin' ? 'Soporte' : 'Tú'} · {formatDate(msg.createdAt)}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Reply Input */}
                {!isClosed && (
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
                            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Enviar
                        </button>
                    </div>
                )}

                {isClosed && (
                    <div className="p-4 border-t text-center text-gray-500 text-sm">
                        Este reclamo está {claim.status.toLowerCase()}. No puedes enviar más mensajes.
                    </div>
                )}
            </div>
        </div>
    );
};

// Main Component
interface ClientClaimsProps {
    preselectedBookingId?: string;
}

const ClientClaims: React.FC<ClientClaimsProps> = ({ preselectedBookingId: propBookingId }) => {
    const location = useLocation();
    const locationBookingId = (location.state as { preselectedBookingId?: string })?.preselectedBookingId;
    // Prefer prop over location state (prop comes from ClientDashboard navigation)
    const preselectedBookingId = propBookingId || locationBookingId;

    const [claims, setClaims] = useState<Claim[]>([]);
    const [bookings, setBookings] = useState<BookingOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(!!preselectedBookingId);
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [claimsRes, bookingsRes] = await Promise.all([
                api.get('/claims'),
                api.get('/claims/bookings')
            ]);

            if (claimsRes.data.status === 'success') {
                setClaims(claimsRes.data.claims || []);
            }
            if (bookingsRes.data.status === 'success') {
                setBookings(bookingsRes.data.bookings || []);
            }
        } catch (err: any) {
            console.error('Error fetching claims:', err);
            setError(err.response?.data?.message || 'Error al cargar reclamos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (selectedClaimId) {
        return (
            <ClaimDetailView
                claimId={selectedClaimId}
                onBack={() => {
                    setSelectedClaimId(null);
                    fetchData();
                }}
            />
        );
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Reclamos</h1>
                    <p className="mt-1 text-gray-600">Gestiona y revisa el estado de tus reclamos formales.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Loader2 className="h-12 w-12 text-gray-300 mx-auto animate-spin" />
                    <p className="mt-4 text-gray-500">Cargando reclamos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Reclamos</h1>
                    <p className="mt-1 text-gray-600">Gestiona y revisa el estado de tus reclamos formales.</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700">{error}</p>
                    <button onClick={fetchData} className="mt-4 text-red-600 hover:text-red-800 font-medium">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Mis Reclamos</h1>
                        <p className="mt-1 text-gray-600">Gestiona y revisa el estado de tus reclamos formales.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto bg-brand-primary hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-md"
                    >
                        <Plus size={18} />
                        <span>Iniciar Nuevo Reclamo</span>
                    </button>
                </div>

                {claims.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Reclamo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plazo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {claims.map(claim => (
                                        <tr key={claim.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-mono text-sm text-gray-600">{claim.claimNumber}</td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-800">{claim.serviceName}</p>
                                                <p className="text-xs text-gray-400">{claim.providerName}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(claim.amount)}</td>
                                            <td className="px-6 py-4"><StatusBadge status={claim.status} /></td>
                                            <td className="px-6 py-4">
                                                {claim.deadline ? <Countdown to={claim.deadline} /> : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setSelectedClaimId(claim.id)}
                                                    className="text-brand-primary hover:text-orange-600 font-medium text-sm flex items-center gap-1"
                                                >
                                                    <MessageCircle size={14} /> Ver Detalle
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                        <AlertTriangle className="mx-auto h-16 w-16 text-gray-300" strokeWidth={1} />
                        <h3 className="mt-4 text-lg font-semibold text-gray-800">No tienes reclamos activos</h3>
                        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                            Esperamos que no lo necesites, pero si tienes un problema con una orden, puedes iniciar un reclamo aquí.
                        </p>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <NewClaimModal
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={fetchData}
                        bookings={bookings}
                        preselectedBookingId={preselectedBookingId}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default ClientClaims;
