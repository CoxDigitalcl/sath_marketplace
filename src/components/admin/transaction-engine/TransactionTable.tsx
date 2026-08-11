import React from 'react';
import { Order } from '../../../types';
import TransactionStatusBadge from './TransactionStatusBadge';
import { Eye } from 'lucide-react';

interface TransactionTableProps {
    orders: Order[];
    onViewOrder: (id: string) => void;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ orders, onViewOrder }) => {
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-CL', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Proveedor</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Orden</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Payout</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Creación</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only"></span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-semibold text-gray-900">{order.order_number}</div>
                                    <div className="text-xs text-gray-500 font-mono">{order.payku_transaction_id || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{order.customer_name}</div>
                                    <div className="text-sm text-gray-500">{order.provider_name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{formatCurrency(order.total_clp)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <TransactionStatusBadge status={order.status} type="order" />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <TransactionStatusBadge status={order.payout_status} type="payout" />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(order.created_at)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onViewOrder(order.id)} className="text-brand-primary hover:text-orange-600 flex items-center">
                                        <Eye size={16} className="mr-1"/> Ver
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransactionTable;