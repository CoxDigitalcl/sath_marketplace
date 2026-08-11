import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Product } from '../../../types';
import ProductList from '../products/ProductList';
import ProductForm from '../products/ProductForm';
import ProductInventory from '../products/ProductInventory';
import { List, Plus, Package } from 'lucide-react';

// --- MOCK DATA ---
const mockProductsData: Product[] = [
    { id: 'prod_1', name: 'Curso Online "Intro a React"', description: 'Aprende React desde cero con este curso completo.', price_clp: 50000, iva_clp: 9500, sku: 'CUR-REACT-01', stock: 999, images: ['https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=870&auto=format&fit=crop'], status: 'active' },
    { id: 'prod_2', name: 'Plantilla de Diseño "Neón"', description: 'Set de plantillas editables para redes sociales.', price_clp: 15000, iva_clp: 2850, sku: 'TMP-NEON-01', stock: 5, images: ['https://images.unsplash.com/photo-1555940280-66e8072b25f0?q=80&w=870&auto=format&fit=crop'], status: 'active' },
    { id: 'prod_3', name: 'E-book "Guía de Finanzas"', description: 'Guía práctica para ordenar tus finanzas personales.', price_clp: 10000, iva_clp: 1900, sku: 'EBK-FIN-01', stock: 0, images: ['https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=870&auto=format&fit=crop'], status: 'out_of_stock' },
    { id: 'prod_4', name: 'Kit de Herramientas Digitales', description: 'Pack de herramientas para productividad.', price_clp: 25000, iva_clp: 4750, sku: 'KIT-DIGI-01', stock: 50, images: ['https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=1031&auto=format&fit=crop'], status: 'paused' },
    { id: 'prod_5', name: 'Asesoría de Marca Personal', description: 'Sesión de 1 hora para definir tu marca.', price_clp: 75000, iva_clp: 14250, sku: 'AS-MARCA-01', stock: 15, images: ['https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=870&auto=format&fit=crop'], status: 'draft' },
];
// --- END MOCK DATA ---

type ActiveTab = 'list' | 'form' | 'inventory';

const ProviderProducts: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('list');
    const [products, setProducts] = useState<Product[]>(mockProductsData);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setActiveTab('form');
    };

    const handleAdd = () => {
        setEditingProduct(null);
        setActiveTab('form');
    };

    const handleSave = (productToSave: Product) => {
        if (productToSave.id) {
            setProducts(products.map(p => p.id === productToSave.id ? productToSave : p));
        } else {
            setProducts([...products, { ...productToSave, id: `prod_${Date.now()}` }]);
        }
        setActiveTab('list');
        setEditingProduct(null);
    };

    const handleCancel = () => {
        setActiveTab('list');
        setEditingProduct(null);
    };

    const handleDelete = (productId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este producto?")) {
            setProducts(products.filter(p => p.id !== productId));
        }
    };
    
    const handleToggleStatus = (productId: string, currentStatus: Product['status']) => {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        setProducts(products.map(p => p.id === productId ? { ...p, status: newStatus } : p));
    };
    
    const handleStockUpdate = (productId: string, newStock: number) => {
        setProducts(products.map(p => {
            if (p.id === productId) {
                const updatedProduct = { ...p, stock: newStock };
                if (newStock <= 0 && p.status !== 'draft') {
                    updatedProduct.status = 'out_of_stock';
                } else if (newStock > 0 && p.status === 'out_of_stock') {
                    updatedProduct.status = 'active';
                }
                return updatedProduct;
            }
            return p;
        }));
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'list': return <ProductList products={products} onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggleStatus} />;
            case 'form': return <ProductForm product={editingProduct} onSave={handleSave} onCancel={handleCancel} />;
            case 'inventory': return <ProductInventory products={products} onStockUpdate={handleStockUpdate} />;
            default: return null;
        }
    };

    const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
        { id: 'list', label: 'Lista', icon: List },
        { id: 'inventory', label: 'Inventario', icon: Package },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Gestión de Productos</h1>
                    <p className="mt-1 text-gray-600">Crea, edita y gestiona tus productos y controla el inventario.</p>
                </div>
                {activeTab !== 'form' && (
                     <button onClick={handleAdd} className="flex items-center justify-center gap-2 w-full sm:w-auto bg-brand-secondary hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-300">
                        <Plus size={18} />
                        <span>Nuevo Producto</span>
                    </button>
                )}
            </div>
            
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-brand-secondary text-brand-secondary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <tab.icon size={16} className="mr-2" />
                            {tab.label}
                        </button>
                    ))}
                    {activeTab === 'form' && (
                         <div className="whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm border-brand-secondary text-brand-secondary">
                            <Plus size={16} className="mr-2" />
                            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                        </div>
                    )}
                </nav>
            </div>
            
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {renderContent()}
            </motion.div>
        </div>
    );
};

export default ProviderProducts;
