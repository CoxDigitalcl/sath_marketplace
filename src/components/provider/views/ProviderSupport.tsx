import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketCategory } from '../../../types';
import { Plus, X, Paperclip, Send, ChevronLeft, Loader2, MessageCircle, Clock } from 'lucide-react';
import { api } from '../../../api/client';

interface Ticket {
    id: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    messageCount?: number;
}

interface Message {
    id: string;
    senderId: string;
    senderEmail: string;
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

const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
};

// New Ticket Modal
const NewTicketModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const form = e.target as HTMLFormElement;

        try {
            const uploadData = new FormData();
            uploadData.append('category', form.category.value);
            uploadData.append('subject', form.subject.value);
            uploadData.append('description', form.description.value);
            if (file) uploadData.append('file', file);

            await api.post('/support/tickets', uploadData, {
                headers: { 'Content-Type': undefined }
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al crear ticket');
        } finally {
            setLoading(false);
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
                        <h3 className="text-xl font-bold text-gray-800">Crear Nuevo Ticket de Soporte</h3>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={24} /></button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Categoría</label>
                            <select id="category" name="category" required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">Selecciona una categoría...</option>
                                <option value={TicketCategory.PAYMENT_ISSUE}>Problema de Pago</option>
                                <option value={TicketCategory.TECHNICAL_BUG}>Bug Técnico</option>
                                <option value={TicketCategory.DISPUTE}>Disputa Cliente-Proveedor</option>
                                <option value="configuracion">Configuración de cuenta</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Asunto</label>
                            <input type="text" id="subject" name="subject" required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</label>
                            <textarea id="description" name="description" rows={6} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="Describe tu problema con el mayor detalle posible..."></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Adjuntar Archivos (Opcional)</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="flex text-sm text-gray-600">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-secondary hover:text-gray-900">
                                            <span>Sube un archivo</span>
                                            <input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                                        </label>
                                        <p className="pl-1">o arrastra y suelta</p>
                                    </div>
                                    <p className="text-xs text-gray-500">{file?.name || 'PNG, JPG, PDF hasta 10MB'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-brand-secondary hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2">
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            Enviar Ticket
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
    const [ticket, setTicket] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const fetchTicketDetail = async () => {
        try {
            const res = await api.get(`/support/tickets/${ticketId}`);
            if (res.data.status === 'success') {
                setTicket(res.data.ticket);
                setMessages(res.data.messages || []);
            }
        } catch (err) {
            console.error('Error fetching ticket detail:', err);
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
            await api.post(`/support/tickets/${ticketId}/messages`, { message: newMessage });
            setNewMessage('');
            fetchTicketDetail();
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

    if (!ticket) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Ticket no encontrado</p>
                <button onClick={onBack} className="mt-4 text-brand-secondary hover:underline">Volver</button>
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
                    <p className="text-sm text-gray-500">{ticket.category} · Creado {formatDate(ticket.created_at)}</p>
                </div>
                <StatusBadge status={ticket.status} />
            </div>

            {/* Ticket Info */}
            {ticket.description && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Descripción Original</h3>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{ticket.description}</p>
                </div>
            )}

            {/* Messages */}
            <div className="bg-white border rounded-lg">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <MessageCircle size={18} /> Conversación ({messages.length})
                    </h3>
                </div>
                <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No hay mensajes aún. Envía el primero para comenzar la conversación.</p>
                    )}
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderRole === 'admin' ? 'justify-start' : 'justify-end'}`}
                        >
                            <div className={`max-w-[70%] ${msg.senderRole === 'admin' ? 'bg-gray-100 text-gray-800' : 'bg-brand-secondary text-white'} rounded-lg p-3`}>
                                <p className="text-xs opacity-75 mb-1">
                                    {msg.senderRole === 'admin' ? 'Soporte' : 'Tú'} · {formatDate(msg.createdAt)}
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
                            placeholder="Escribe un mensaje..."
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={sending || !newMessage.trim()}
                            className="px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Enviar
                        </button>
                    </div>
                )}

                {ticket.status === 'Cerrado' && (
                    <div className="p-4 border-t text-center text-gray-500 text-sm">
                        Este ticket está cerrado. No puedes enviar más mensajes.
                    </div>
                )}
            </div>
        </div>
    );
};

// Main Component
const ProviderSupport: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await api.get('/support/tickets');
            if (res.data.status === 'success') {
                setTickets(res.data.tickets || []);
            }
        } catch (error) {
            console.error("Error fetching tickets", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

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
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Soporte</h1>
                        <p className="mt-1 text-gray-600">
                            Crea nuevos tickets de soporte y revisa el historial de tus solicitudes.
                        </p>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 w-full sm:w-auto bg-brand-secondary hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md">
                        <Plus size={18} />
                        <span>Crear Nuevo Ticket</span>
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-semibold text-gray-800">Historial de Tickets</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última Actividad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-8 w-8 text-gray-300 mx-auto animate-spin" /></td></tr>
                                ) : tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900">{ticket.subject}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{ticket.category}</td>
                                        <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(ticket.updatedAt || ticket.createdAt)}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedTicketId(ticket.id)}
                                                className="text-brand-secondary hover:text-gray-700 font-medium text-sm flex items-center gap-1"
                                            >
                                                <MessageCircle size={14} /> Ver Detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && tickets.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-gray-500">
                                            No tienes tickets de soporte. ¡Crea uno si necesitas ayuda!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isModalOpen && <NewTicketModal onClose={() => setIsModalOpen(false)} onSuccess={fetchTickets} />}
            </AnimatePresence>
        </>
    );
};

export default ProviderSupport;
