import React, { useState, useMemo } from 'react';
import { ClientStatus } from '../../../types';
import ClientFilters from '../client-management/ClientFilters';
import ClientTable from '../client-management/ClientTable';
import ClientProfile from './ClientProfile';

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




export interface Client {
    id: string;
    avatarUrl: string;
    email: string;
    nombre: string;
    rut: string;
    status: ClientStatus;
    ltv: number;
    totalOrders: number;
    complaintRate: number;
    fraudScore: number;
    registrationDate: string;
    isVerified: boolean;
    hasSernacClaim: boolean;
    last_invoice_url?: string;
}

const ITEMS_PER_PAGE = 10;

const ClientManagement: React.FC = () => {
    // API State
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        search: '',
        rut: '',
        status: [] as ClientStatus[],
        fraudScoreMin: '',
        dateFrom: '',
        dateTo: '',
    });
    const [currentPage, setCurrentPage] = useState(1);

    React.useEffect(() => {
        const fetchClients = async () => {
            try {
                const token = JSON.parse(sessionStorage.getItem('auth-storage') || '{}').state?.token;
                const response = await adminFetch('/api/admin/clients', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const resData = await response.json();
                    if (resData.status === 'success') {
                        setClients(resData.data);
                    }
                }
            } catch (err) {
                console.error("Error fetching clients:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, []);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const searchLower = filters.search.toLowerCase();
            const matchesSearch =
                (client.nombre || '').toLowerCase().includes(searchLower) ||
                (client.email || '').toLowerCase().includes(searchLower);

            const matchesRut = filters.rut === '' || (client.rut || '').replace(/\./g, '').replace('-', '') === filters.rut.replace(/\./g, '').replace('-', '');

            const matchesStatus =
                filters.status.length === 0 || filters.status.includes(client.status);

            const matchesFraudScore = filters.fraudScoreMin === '' || client.fraudScore >= parseInt(filters.fraudScoreMin);

            return matchesSearch && matchesRut && matchesStatus && matchesFraudScore;
        });
    }, [filters, clients]);

    const paginatedClients = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredClients, currentPage]);

    const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

    const selectedClient = useMemo(() => {
        return clients.find(p => p.id === selectedClientId) || null;
    }, [selectedClientId, clients]);

    if (selectedClient) {
        return <ClientProfile client={selectedClient} onBack={() => setSelectedClientId(null)} />;
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando clientes...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Clientes</h1>
                <p className="mt-1 text-gray-600">Controla el ciclo de vida de los clientes, gestiona el riesgo y la comunicación.</p>
            </div>

            <ClientFilters filters={filters} setFilters={setFilters} />

            <ClientTable
                clients={paginatedClients}
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                onViewClient={setSelectedClientId}
            />
        </div>
    );
};

export default ClientManagement;