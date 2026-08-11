import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProviderStatus } from '../../../types';

interface ProviderFiltersProps {
    filters: {
        search: string;
        status: ProviderStatus[];
        incomeMin: string;
        incomeMax: string;
        dateFrom: string;
        dateTo: string;
    };
    setFilters: React.Dispatch<React.SetStateAction<ProviderFiltersProps['filters']>>;
}

const statusOptions = Object.values(ProviderStatus);

const ProviderFilters: React.FC<ProviderFiltersProps> = ({ filters, setFilters }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, search: e.target.value }));
    };

    const handleStatusChange = (status: ProviderStatus) => {
        setFilters(prev => {
            const newStatus = prev.status.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...prev.status, status];
            return { ...prev, status: newStatus };
        });
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFilters(prev => ({ ...prev, [name]: value }));
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <label htmlFor="search-provider" className="sr-only">Buscar Proveedor</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            id="search-provider"
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                            placeholder="Buscar por nombre de tienda o email..."
                        />
                    </div>
                </div>
                <div>
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                    >
                        <SlidersHorizontal className="h-5 w-5 mr-2" />
                        <span>Más Filtros</span>
                    </button>
                </div>
            </div>
            
             <AnimatePresence>
                {showAdvanced && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                >
                    <div className="pt-4 border-t border-gray-200 space-y-4">
                       <div>
                           <h4 className="text-sm font-medium text-gray-600 mb-2">Estado del Proveedor</h4>
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
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                               <label htmlFor="incomeMin" className="block text-sm font-medium text-gray-600 mb-1">Ingresos (min)</label>
                               <input type="number" name="incomeMin" id="incomeMin" value={filters.incomeMin} onChange={handleInputChange} placeholder="$0" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                            </div>
                            <div>
                               <label htmlFor="incomeMax" className="block text-sm font-medium text-gray-600 mb-1">Ingresos (max)</label>
                               <input type="number" name="incomeMax" id="incomeMax" value={filters.incomeMax} onChange={handleInputChange} placeholder="$10,000" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                            </div>
                            <div>
                               <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-600 mb-1">Registro (desde)</label>
                               <input type="date" name="dateFrom" id="dateFrom" value={filters.dateFrom} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                            </div>
                             <div>
                               <label htmlFor="dateTo" className="block text-sm font-medium text-gray-600 mb-1">Registro (hasta)</label>
                               <input type="date" name="dateTo" id="dateTo" value={filters.dateTo} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                            </div>
                       </div>
                    </div>
                </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default ProviderFilters;
