import React, { useState, useMemo } from 'react';
import { Product } from '../../../types';
import { Search, AlertTriangle, ImageOff } from 'lucide-react';

interface ProductInventoryProps {
    products: Product[];
    onStockUpdate: (productId: string, newStock: number) => void;
}

const LOW_STOCK_THRESHOLD = 10;

const ProductInventory: React.FC<ProductInventoryProps> = ({ products, onStockUpdate }) => {
    const [search, setSearch] = useState('');
    const [stockInputs, setStockInputs] = useState<Record<string, string>>({});

    const filteredProducts = useMemo(() => {
        return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
    }, [products, search]);

    const handleInputChange = (productId: string, value: string) => {
        setStockInputs(prev => ({ ...prev, [productId]: value }));
    };

    const handleUpdateClick = (productId: string) => {
        const newStockValue = stockInputs[productId];
        if (newStockValue && !isNaN(parseInt(newStockValue))) {
            onStockUpdate(productId, parseInt(newStockValue));
            setStockInputs(prev => {
                const newInputs = { ...prev };
                delete newInputs[productId];
                return newInputs;
            });
        }
    };
    
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b">
                <div className="relative md:w-1/2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Actual</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actualizar Stock</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.map(product => {
                            const isLowStock = product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
                            const isOutOfStock = product.stock === 0;

                            return (
                                <tr key={product.id} className={`${isLowStock ? 'bg-yellow-50' : ''} ${isOutOfStock ? 'bg-red-50' : ''}`}>
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
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center text-sm font-semibold">
                                            {(isLowStock || isOutOfStock) && <AlertTriangle size={16} className={`mr-2 ${isOutOfStock ? 'text-red-500' : 'text-yellow-500'}`} />}
                                            <span className={`${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-800'}`}>
                                                {product.stock} unidades
                                            </span>
                                        </div>
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={stockInputs[product.id] || ''}
                                                onChange={e => handleInputChange(product.id, e.target.value)}
                                                placeholder="Nuevo stock"
                                                className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm"
                                            />
                                            <button 
                                                onClick={() => handleUpdateClick(product.id)}
                                                disabled={!stockInputs[product.id]}
                                                className="px-3 py-1 bg-brand-secondary text-white text-sm font-semibold rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Actualizar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                 </table>
            </div>
        </div>
    );
};

export default ProductInventory;
