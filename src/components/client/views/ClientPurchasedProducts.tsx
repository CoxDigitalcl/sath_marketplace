import React, { useState, useEffect } from 'react';
import { ImageOff, PackageCheck, Send, AlertTriangle, Package, AlertCircle } from 'lucide-react';
import { api } from '../../../api/client';

// This component is prepared for future product integration
// Currently the platform only offers services, so this will show empty state

interface PurchasedProduct {
    id: string;
    name: string;
    image?: string;
    provider: string;
    date: string;
    status: string;
    trackingNumber?: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: { [key: string]: string } = {
        'Procesando': 'bg-blue-100 text-blue-800',
        'Enviado': 'bg-purple-100 text-purple-800',
        'Entregado': 'bg-green-100 text-green-800',
        'Devuelto': 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
};

const ClientPurchasedProducts: React.FC = () => {
    const [products, setProducts] = useState<PurchasedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                // TODO: Replace with actual products endpoint when available
                // const response = await api.get('/products/purchased');
                // For now, simulate empty response since products feature is not active
                setProducts([]);
            } catch (err: any) {
                console.error('Error fetching products:', err);
                setError(err.response?.data?.message || 'Error de conexión');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Productos Comprados</h1>
                    <p className="mt-1 text-gray-600">Aquí podrás ver el estado y tracking de los productos que has comprado.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                        <div className="h-4 w-48 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Productos Comprados</h1>
                    <p className="mt-1 text-gray-600">Aquí podrás ver el estado y tracking de los productos que has comprado.</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Productos Comprados</h1>
                <p className="mt-1 text-gray-600">Aquí podrás ver el estado y tracking de los productos que has comprado.</p>
            </div>

            {products.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes productos comprados</h3>
                    <p className="text-gray-500">Cuando compres un producto, aparecerá aquí.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Compra</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {products.map(product => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                                                    {product.image ? (
                                                        <img className="h-10 w-10 rounded-md object-cover" src={product.image} alt={product.name} />
                                                    ) : (
                                                        <ImageOff className="h-5 w-5 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.provider}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(product.date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={product.status} /></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {product.trackingNumber ? (
                                                <a href="#" className="text-brand-primary hover:underline font-medium">{product.trackingNumber}</a>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center gap-4">
                                                {product.status === 'Enviado' && (
                                                    <button className="text-green-600 hover:text-green-800 flex items-center gap-1 font-bold">
                                                        <PackageCheck size={16} /> Confirmar Entrega
                                                    </button>
                                                )}
                                                <button className="text-gray-600 hover:text-brand-primary flex items-center gap-1">
                                                    <Send size={16} /> Contactar
                                                </button>
                                                {product.status === 'Enviado' && (
                                                    <button className="text-red-600 hover:text-red-800 flex items-center gap-1">
                                                        <AlertTriangle size={16} /> Reclamar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientPurchasedProducts;
