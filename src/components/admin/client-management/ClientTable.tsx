import React from 'react';
import { Client } from '../views/ClientManagement';
import ClientStatusBadge from './ClientStatusBadge';
import { MoreVertical, Eye, MessageSquare, AlertTriangle } from 'lucide-react';

interface ClientTableProps {
    clients: Client[];
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number) => void;
    onViewClient: (id: string) => void;
}

const ClientTable: React.FC<ClientTableProps> = ({ clients, currentPage, totalPages, setCurrentPage, onViewClient }) => {

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RUT</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LTV</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fraude Score</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registrado</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {clients.map(client => (
                            <tr key={client.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        {/* FIX: The `title` prop is not supported on lucide-react icons. Wrapped the icon in a `span` with a title to show the tooltip. */}
                                        {client.hasSernacClaim && <span title="Reclamo SERNAC abierto"><AlertTriangle size={16} className="text-red-500 mr-2 flex-shrink-0" /></span>}
                                        <img className="h-10 w-10 rounded-full object-cover" src={client.avatarUrl} alt={client.nombre} />
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{client.nombre}</div>
                                            <div className="text-sm text-gray-500">{client.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{client.rut}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <ClientStatusBadge status={client.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">{formatCurrency(client.ltv)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                    <span className={client.fraudScore > 70 ? 'text-red-600' : client.fraudScore > 40 ? 'text-yellow-600' : 'text-green-600'}>
                                        {client.fraudScore}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(client.registrationDate)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="relative inline-block text-left group">
                                        <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors">
                                            <MoreVertical size={20} />
                                        </button>
                                        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                            <div className="py-1" role="menu" aria-orientation="vertical">
                                                <button onClick={() => onViewClient(client.id)} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem"><Eye size={16} className="mr-3" />Ver Perfil Detallado</button>
                                                <button className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem"><MessageSquare size={16} className="mr-3" />Enviar Mensaje</button>
                                                {client.last_invoice_url && (
                                                    <a href={client.last_invoice_url} target="_blank" rel="noopener noreferrer" className="w-full text-left flex items-center px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 font-medium" role="menuitem">
                                                        {/* Assuming Package/FileText icon would be better, but Eye is imported. Adding simple text for now or reuse Eye if stuck. */}
                                                        <span className="mr-3">📄</span> Ver Última Boleta
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {clients.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-gray-500">
                                    No se encontraron clientes con los filtros actuales.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div><p className="text-sm text-gray-700">Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span></p></div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                        <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Siguiente</button>
                    </nav>
                </div>
            </div>
        </div>
    );
};

export default ClientTable;