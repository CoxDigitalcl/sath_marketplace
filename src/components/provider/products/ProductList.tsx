import React, { useState, useMemo } from 'react';
import { Product } from '../../../types';
import { Edit, Trash2, Search, ImageOff } from 'lucide-react';
import ToggleSwitch from '../../admin/provider-management/ToggleSwitch';

interface ProductListProps {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (productId: string) => void;
    onToggleStatus: (productId: string, currentStatus: Product['status']) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onEdit, onDelete, onToggleStatus }) => {
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        stock: '',
    });

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const searchLower = filters.search.toLowerCase();
            const matchesSearch = product.name.toLowerCase().includes(searchLower) || product.sku.toLowerCase().includes(searchLower);
            const matchesStatus = filters.status === '' || product.status === filters.status;
            const matchesStock = filters.stock === '' || (filters.stock === 'low' && product.stock > 0 && product.stock <= 10) || (filters.stock === 'out' && product.stock === 0);
            return matchesSearch && matchesStatus && matchesStock;
        });
    }, [products, filters]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

    const getStatusBadge = (status: Product['status']) => {
        const styles = {
            'active': 'bg-green-100 text-green-800',
            'paused': 'bg-yellow-100 text-yellow-800',
            'draft': 'bg-gray-100 text-gray-800',
            'out_of_stock': 'bg-red-100 text-red-800',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</span>;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={filters.search}
                        onChange={e => setFilters(prev => ({...prev, search: e.target.value}))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                    <select value={filters.status} onChange={e => setFilters(prev => ({...prev, status: e.target.value}))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
                        <option value="">Todos los Estados</option>
                        <option value="active">Activo</option>
                        <option value="paused">Pausado</option>
                        <option value="draft">Borrador</option>
                        <option value="out_of_stock">Agotado</option>
                    </select>
                     <select value={filters.stock} onChange={e => setFilters(prev => ({...prev, stock: e.target.value}))} className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50">
                        <option value="">Todo el Stock</option>
                        <option value="low">Bajo Stock (&lt;=10)</option>
                        <option value="out">Agotado</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.map(product => (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                                            {product.images && product.images[0] ? (
                                                <img className="h-10 w-10 rounded-md object-cover" src={product.images[0]} alt={product.name} />
                                            ) : (
                                                <ImageOff className="h-5 w-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                            <div className="text-sm text-gray-500 font-mono">{product.sku}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatCurrency(product.price_clp)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`text-sm font-semibold ${product.stock <= 10 ? 'text-red-600' : 'text-gray-800'}`}>
                                        {product.stock}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(product.status)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-4">
                                        <ToggleSwitch 
                                            enabled={product.status === 'active'}
                                            onChange={() => onToggleStatus(product.id, product.status)} 
                                        />
                                        <button onClick={() => onEdit(product)} className="text-gray-600 hover:text-brand-secondary"><Edit size={18} /></button>
                                        <button onClick={() => onDelete(product.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-gray-500">
                                    No se encontraron productos.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductList;
