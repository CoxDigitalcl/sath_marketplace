import React from 'react';
import { Search } from 'lucide-react';
import { ClientStatus } from '../../../types';

interface ClientFiltersProps {
    filters: {
        search: string;
        rut: string;
        status: ClientStatus[];
        fraudScoreMin: string;
        dateFrom: string;
        dateTo: string;
    };
    setFilters: React.Dispatch<React.SetStateAction<ClientFiltersProps['filters']>>;
}

const statusOptions = Object.values(ClientStatus);

const ClientFilters: React.FC<ClientFiltersProps> = ({ filters, setFilters }) => {

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleStatusChange = (status: ClientStatus) => {
        setFilters(prev => {
            const newStatus = prev.status.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...prev.status, status];
            return { ...prev, status: newStatus };
        });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                    <label htmlFor="search-client" className="sr-only">Buscar Cliente</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            name="search"
                            id="search-client"
                            value={filters.search}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                            placeholder="Buscar por nombre o email..."
                        />
                    </div>
                </div>
                 <div>
                    <label htmlFor="rut" className="sr-only">RUT</label>
                    <input
                        type="text"
                        name="rut"
                        id="rut"
                        value={filters.rut}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                        placeholder="RUT (ej: 12.345.678-9)"
                    />
                </div>
                 <div>
                    <label htmlFor="fraudScoreMin" className="sr-only">Fraude Score Mín.</label>
                    <input
                        type="number"
                        name="fraudScoreMin"
                        id="fraudScoreMin"
                        value={filters.fraudScoreMin}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                        placeholder="Fraude Score > X"
                    />
                </div>
            </div>
             <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Estado del Cliente</h4>
                <div className="flex flex-wrap gap-2">
                    {statusOptions.map(status => (
                        <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                filters.status.includes(status)
                                    ? 'bg-brand-primary text-white border-brand-primary'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ClientFilters;
