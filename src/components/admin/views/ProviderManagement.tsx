import React, { useState, useMemo } from 'react';
import { ProviderStatus } from '../../../types';
import ProviderFilters from '../provider-management/ProviderFilters';
import ProviderTable from '../provider-management/ProviderTable';
import ProviderProfile from './ProviderProfile'; // Import the new Profile view
import { api } from '../../../api/client';

export interface Provider {
    id: string;
    storeName: string;
    avatarUrl: string;
    ownerEmail: string;
    status: ProviderStatus;
    mainCategory: string;
    income30d: number;
    orders30d: number;
    rating: number;
    cancellationRate: number;
    payoutsEnabled: boolean;
    registrationDate: string;
}

const ITEMS_PER_PAGE = 10;

const ProviderManagement: React.FC = () => {
    // State for API Data
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for UI/Filters
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        search: '',
        status: [] as ProviderStatus[],
        incomeMin: '',
        incomeMax: '',
        dateFrom: '',
        dateTo: '',
    });
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch Providers from API
    React.useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await api.get('/admin/providers');
                
                if (response.data.status === 'success') {
                    setProviders(response.data.data);
                } else {
                    setError(`API Error: ${response.data.message || 'Unknown error'}`);
                }
            } catch (err: any) {
                console.error("Error fetching providers:", err);
                // Do not show error explicitly if it is a session expiration
                if (err.response?.status !== 401 && err.response?.status !== 403) {
                    setError(`Network Error: ${err.response?.data?.message || err.message}`);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProviders();
    }, []);

    const filteredProviders = useMemo(() => {
        return providers.filter(provider => {
            const searchLower = filters.search.toLowerCase();
            const matchesSearch =
                (provider.storeName || '').toLowerCase().includes(searchLower) ||
                (provider.ownerEmail || '').toLowerCase().includes(searchLower);

            const matchesStatus =
                filters.status.length === 0 || filters.status.includes(provider.status);

            return matchesSearch && matchesStatus;
        });
    }, [filters, providers]);

    const paginatedProviders = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProviders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredProviders, currentPage]);

    const totalPages = Math.ceil(filteredProviders.length / ITEMS_PER_PAGE);

    const selectedProvider = useMemo(() => {
        return providers.find(p => p.id === selectedProviderId) || null;
    }, [selectedProviderId, providers]);

    if (selectedProvider) {
        return <ProviderProfile provider={selectedProvider} onBack={() => setSelectedProviderId(null)} />;
    }

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando proveedores...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Proveedores</h1>
                <p className="mt-1 text-gray-600">Controla el ciclo de vida de los proveedores, desde su ingreso hasta su performance.</p>
                {error && (
                    <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                        <p className="font-bold">Error Loading Providers</p>
                        <p>{error}</p>
                    </div>
                )}
            </div>

            <ProviderFilters filters={filters} setFilters={setFilters} />

            <ProviderTable
                providers={paginatedProviders}
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                onViewProvider={setSelectedProviderId}
                onUpdateProvider={(updatedProvider) => {
                    setProviders(prev => prev.map(p => p.id === updatedProvider.id ? { ...p, ...updatedProvider } : p));
                }}
            />
        </div>
    );
};

export default ProviderManagement;
