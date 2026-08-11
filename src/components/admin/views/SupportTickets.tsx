
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '../../../types';
import { MoreVertical, Filter, Search, User, Briefcase, ChevronDown, Plus, X, Save } from 'lucide-react';

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




// Mock data removed. Now using real DB.

const PriorityBadge: React.FC<{ priority: TicketPriority }> = ({ priority }) => {
    const config = {
        [TicketPriority.HIGH]: 'bg-red-100 text-red-800',
        [TicketPriority.MEDIUM]: 'bg-yellow-100 text-yellow-800',
        [TicketPriority.LOW]: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config[priority]}`}>{priority}</span>;
};

const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
    const config = {
        [TicketStatus.OPEN]: 'bg-blue-100 text-blue-800',
        [TicketStatus.CLOSED]: 'bg-gray-100 text-gray-600',
        [TicketStatus.ESCALATED]: 'bg-purple-100 text-purple-800',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config[status]}`}>{status}</span>;
};

interface CreateTicketModalProps {
    onClose: () => void;
    onCreate: (ticket: Omit<SupportTicket, 'id' | 'lastActivity' | 'status' | 'assignedAgent'>) => void;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ onClose, onCreate }) => {
    const [role, setRole] = useState<'Cliente' | 'Proveedor'>('Cliente');
    const [userId, setUserId] = useState('');
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<TicketCategory>(TicketCategory.TECHNICAL_BUG);
    const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate({
            senderId: userId || 'Usuario Manual',
            senderRole: role,
            subject,
            category,
            priority,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">Crear Ticket Manual</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol Solicitante</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as any)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-2 px-3"
                            >
                                <option value="Cliente">Cliente</option>
                                <option value="Proveedor">Proveedor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ID / Email Usuario</label>
                            <input
                                type="text"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                placeholder="ej. juan@email.com"
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-2 px-3"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-2 px-3"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-2 px-3"
                            >
                                {Object.values(TicketCategory).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-2 px-3"
                            >
                                {Object.values(TicketPriority).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Problema</label>
                        <textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-2 px-3"
                            placeholder="Detalles reportados por el usuario..."
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-md hover:opacity-90 font-medium flex items-center">
                            <Save size={18} className="mr-2" /> Crear Ticket
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

const SupportTickets: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTickets = async () => {
        try {
            const response = await adminFetch('/api/admin/tickets');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    setTickets(data.data);
                }
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleCreateTicket = async (newTicketData: Omit<SupportTicket, 'id' | 'lastActivity' | 'status' | 'assignedAgent'>) => {
        try {
            const response = await adminFetch('/api/admin/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Flattening the object for the API
                    ...newTicketData,
                    description: 'Ticket creado manualmente desde panel admin' // Default desc if not passed (modal passes it separately usually, but adapting here)
                })
            });

            if (response.ok) {
                // Refresh list
                fetchTickets();
            }
        } catch (error) {
            console.error("Error creating ticket:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Tickets de Soporte</h1>
                    <p className="mt-1 text-gray-600">Bandeja de entrada unificada para atender las solicitudes de clientes y proveedores.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-md shadow-sm hover:opacity-90 font-medium transition-colors"
                >
                    <Plus size={20} className="mr-2" /> Crear Ticket
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input type="text" placeholder="Buscar por ID, asunto o usuario..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-md"><Filter size={20} /></button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agente</th>
                                <th className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tickets.map(ticket => (
                                <tr key={ticket.id} className={`${ticket.priority === TicketPriority.HIGH && ticket.status === TicketStatus.OPEN ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-sm text-gray-800">{ticket.id}</div>
                                        <div className="text-xs text-gray-500 flex items-center mt-1">
                                            {ticket.senderRole === 'Cliente' ? <User size={12} className="mr-1" /> : <Briefcase size={12} className="mr-1" />}
                                            <span className="truncate max-w-[120px]">{ticket.senderId}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</div>
                                        <div className="text-xs text-gray-500">{new Date(ticket.lastActivity).toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ticket.category}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><PriorityBadge priority={ticket.priority} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={ticket.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.assignedAgent}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100"><MoreVertical size={20} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <CreateTicketModal
                        onClose={() => setIsModalOpen(false)}
                        onCreate={handleCreateTicket}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default SupportTickets;
