import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, Plus, X, Send, Loader2, AlertCircle,
    ChevronLeft, Clock, User, Filter, CheckCircle, XCircle,
    AlertTriangle
} from 'lucide-react';

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



interface Ticket {
    id: string;
    ticketNumber: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    userRole: string;
    creatorEmail: string;
    creatorName: string;
    targetEmail: string | null;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface Message {
    id: string;
    senderId: string;
    senderEmail: string;
    senderName: string;
    senderRole: string;
    message: string;
    attachmentUrl: string | null;
    createdAt: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: { [key: string]: string } = {
        'Abierto': 'bg-yellow-100 text-yellow-800',
        'En Proceso': 'bg-blue-100 text-blue-800',
        'Resuelto': 'bg-green-100 text-green-800',
        'Cerrado': 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const styles: { [key: string]: string } = {
        'Baja': 'bg-green-50 text-green-700 border-green-200',
        'Media': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        'Alta': 'bg-orange-50 text-orange-700 border-orange-200',
        'Urgente': 'bg-red-50 text-red-700 border-red-200',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[priority] || 'bg-gray-50 text-gray-700'}`}>{priority}</span>;
};

const CATEGORIES = [
    'Cuenta y Acceso',
    'Pagos y Facturación',
    'Verificación KYC',
    'Servicios',
    'Reservas',
    'Soporte Técnico',
    'Otro'
];

// Create Ticket Modal
const CreateTicketModal: React.FC<{
    onClose: () => void;
    onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        targetUserId: '',
        subject: '',
        category: 'Soporte Técnico',
        priority: 'Media',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const response = await adminFetch('/api/admin/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.status === 'success') {
                onSuccess();
                onClose();
            } else {
                setError(result.message || 'Error al crear ticket');
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
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800">Crear Nuevo Ticket</h3>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Usuario Destino (UUID) <span className="text-gray-400 text-xs">- Opcional</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Dejar vacío para ticket general"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                value={formData.targetUserId}
                                onChange={(e) => setFormData({ ...formData, targetUserId: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto *</label>
                            <input
                                type="text"
                                required
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <select
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                                <select
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                >
                                    <option value="Baja">Baja</option>
                                    <option value="Media">Media</option>
                                    <option value="Alta">Alta</option>
                                    <option value="Urgente">Urgente</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje Inicial</label>
                            <textarea
                                rows={4}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                placeholder="Escribe el mensaje inicial del ticket..."
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                        >
                            {submitting && <Loader2 size={16} className="animate-spin" />}
                            Crear Ticket
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

// Ticket Detail View with Chat
const TicketDetailView: React.FC<{
    ticketId: string;
    onBack: () => void;
}> = ({ ticketId, onBack }) => {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const fetchTicketDetail = async () => {
        try {
            const response = await adminFetch(`/api/admin/tickets/${ticketId}`);
            const result = await response.json();
            if (result.status === 'success') {
                setTicket(result.ticket);
                setMessages(result.messages || []);
            }
        } catch (err) {
            setError('Error al cargar ticket');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketDetail();
    }, [ticketId]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        setSending(true);

        try {
            const response = await adminFetch(`/api/admin/tickets/${ticketId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage })
            });

            const result = await response.json();
            if (result.status === 'success') {
                setNewMessage('');
                fetchTicketDetail(); // Refresh messages
            }
        } catch (err) {
            console.error('Send message error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleUpdateStatus = async (status: string) => {
        try {
            const response = await adminFetch(`/api/admin/tickets/${ticketId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            const result = await response.json();
            if (result.status === 'success') {
                fetchTicketDetail();
            }
        } catch (err) {
            console.error('Update status error:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-gray-400" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="text-center py-12">
                <AlertCircle size={48} className="mx-auto mb-3 text-red-400" />
                <p className="text-gray-600">{error || 'Ticket no encontrado'}</p>
                <button onClick={onBack} className="mt-4 text-brand-primary hover:underline">Volver</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800">{ticket.subject}</h2>
                    <p className="text-sm text-gray-500">{ticket.ticketNumber} · {ticket.category}</p>
                </div>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
            </div>

            {/* Ticket Info */}
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                    <span className="text-gray-500">Creado por:</span>
                    <p className="font-medium">{ticket.creatorName}</p>
                    <p className="text-xs text-gray-400">{ticket.creatorEmail}</p>
                </div>
                <div>
                    <span className="text-gray-500">Rol:</span>
                    <p className="font-medium capitalize">{ticket.userRole}</p>
                </div>
                <div>
                    <span className="text-gray-500">Creado:</span>
                    <p className="font-medium">{new Date(ticket.createdAt).toLocaleDateString('es-CL')}</p>
                </div>
                <div>
                    <span className="text-gray-500">Última actividad:</span>
                    <p className="font-medium">{new Date(ticket.updatedAt).toLocaleDateString('es-CL')}</p>
                </div>
            </div>

            {/* Status Actions */}
            {ticket.status !== 'Cerrado' && (
                <div className="flex gap-2">
                    {ticket.status !== 'Resuelto' && (
                        <button
                            onClick={() => handleUpdateStatus('Resuelto')}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                            <CheckCircle size={16} /> Marcar Resuelto
                        </button>
                    )}
                    <button
                        onClick={() => handleUpdateStatus('Cerrado')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                    >
                        <XCircle size={16} /> Cerrar Ticket
                    </button>
                </div>
            )}

            {/* Messages */}
            <div className="bg-white border rounded-lg">
                <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-800">Conversación ({messages.length} mensajes)</h3>
                </div>
                <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No hay mensajes aún</p>
                    )}
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[70%] ${msg.senderRole === 'admin' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-800'} rounded-lg p-3`}>
                                <p className="text-xs opacity-75 mb-1">
                                    {msg.senderName} · {new Date(msg.createdAt).toLocaleString('es-CL')}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Reply Input */}
                {ticket.status !== 'Cerrado' && (
                    <div className="p-4 border-t flex gap-3">
                        <input
                            type="text"
                            placeholder="Escribe una respuesta..."
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
    );
};

// Main Component
const AdminTickets: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const url = statusFilter
                ? `/api/admin/tickets?status=${encodeURIComponent(statusFilter)}`
                : '/api/admin/tickets';
            const response = await adminFetch(url);
            const result = await response.json();
            if (result.status === 'success') {
                setTickets(result.data || []);
            }
        } catch (err) {
            setError('Error al cargar tickets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [statusFilter]);

    if (selectedTicketId) {
        return (
            <TicketDetailView
                ticketId={selectedTicketId}
                onBack={() => {
                    setSelectedTicketId(null);
                    fetchTickets();
                }}
            />
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Tickets de Soporte</h1>
                        <p className="mt-1 text-gray-600">Bandeja de entrada unificada para atender las solicitudes de clientes y proveedores.</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center justify-center gap-2 bg-brand-primary hover:opacity-90 text-white font-semibold py-2 px-4 rounded-md"
                    >
                        <Plus size={18} />
                        Crear Ticket
                    </button>
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
                            <option value="En Proceso">En Proceso</option>
                            <option value="Resuelto">Resuelto</option>
                            <option value="Cerrado">Cerrado</option>
                        </select>
                    </div>
                    <span className="text-sm text-gray-500">{tickets.length} tickets</span>
                </div>

                {/* Tickets Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={32} className="animate-spin text-gray-400" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
                        <p className="text-red-700">{error}</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                        <MessageCircle size={48} className="mx-auto mb-3 text-gray-300" />
                        <h3 className="text-lg font-semibold text-gray-800">No hay tickets</h3>
                        <p className="text-gray-500 mt-1">No se encontraron tickets con los filtros actuales.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensajes</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actualizado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tickets.map(ticket => (
                                    <tr
                                        key={ticket.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => setSelectedTicketId(ticket.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-800">{ticket.subject}</p>
                                            <p className="text-xs text-gray-500">{ticket.ticketNumber}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-800">{ticket.creatorName}</p>
                                            <p className="text-xs text-gray-400 capitalize">{ticket.userRole}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{ticket.category}</td>
                                        <td className="px-6 py-4"><PriorityBadge priority={ticket.priority} /></td>
                                        <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-1 text-sm text-gray-600">
                                                <MessageCircle size={14} /> {ticket.messageCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(ticket.updatedAt).toLocaleDateString('es-CL')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showCreateModal && (
                    <CreateTicketModal
                        onClose={() => setShowCreateModal(false)}
                        onSuccess={fetchTickets}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default AdminTickets;
