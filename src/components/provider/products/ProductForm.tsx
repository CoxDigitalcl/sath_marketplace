import React, { useState, useEffect, FormEvent } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Product } from '../../../types';
import toast from 'react-hot-toast';

interface ProductFormProps {
    product: Product | null;
    onSave: (product: Product) => void;
    onCancel: () => void;
}

const initialFormData: Omit<Product, 'id'> = {
    name: '',
    description: '',
    price_clp: 0,
    iva_clp: 0,
    sku: '',
    stock: 0,
    images: [],
    status: 'draft',
};

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Omit<Product, 'id'>>(initialFormData);

    useEffect(() => {
        if (product) {
            setFormData(product);
        } else {
            setFormData(initialFormData);
        }
    }, [product]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number';
        setFormData(prev => ({ ...prev, [name]: isNumber ? parseInt(value) || 0 : value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        setFormData(prev => ({ ...prev, images: [value] }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // Validations
        if (formData.price_clp < 0) {
            toast.error("El precio no puede ser negativo.");
            return;
        }
        if (formData.stock < 0) {
            toast.error("El stock no puede ser negativo.");
            return;
        }
        onSave({ ...formData, id: product?.id || '' });
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-xl font-bold text-gray-800">{product ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre del Producto</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={4} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="price_clp" className="block text-sm font-medium text-gray-700">Precio (CLP)</label>
                    <input type="number" name="price_clp" id="price_clp" value={formData.price_clp} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU (Código de Producto)</label>
                    <input type="text" name="sku" id="sku" value={formData.sku} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="stock" className="block text-sm font-medium text-gray-700">Stock Inicial</label>
                    <input type="number" name="stock" id="stock" value={formData.stock} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="images" className="block text-sm font-medium text-gray-700">URL de la Imagen Principal</label>
                    <input type="text" name="images" id="images" value={formData.images[0] || ''} onChange={handleImageChange} placeholder="https://..." className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
                <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-300">
                    Cancelar
                </button>
                <button type="submit" className="bg-brand-secondary hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                    Guardar Producto
                </button>
            </div>
        </form>
    );
};

export default ProductForm;
