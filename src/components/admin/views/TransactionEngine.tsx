import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PayoutStatus, RefundStatus } from '../../../types';
import TransactionTable from '../transaction-engine/TransactionTable';
import TransactionDetail from '../transaction-engine/TransactionDetail';

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




// FIX: Export mockOrders to be used in other components.
// Mock data removed. Now fetching from API.


const TransactionEngine: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  React.useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const response = await adminFetch('/api/admin/transactions');

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        if (data.status === 'success') {
          setOrders(data.data);
        } else {
          throw new Error(data.message || 'Error loading data');
        }
      } catch (err: any) {
        console.error('Error fetching transactions:', err);
        setError(err.message);
        // Fallback to empty list or handle gracefully, 
        // avoiding mockOrders to ensure we test real data connection
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleViewOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
    }
  };

  const handleBack = () => {
    setSelectedOrder(null);
  };

  if (selectedOrder) {
    return <TransactionDetail order={selectedOrder} onBack={handleBack} />;
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando transacciones...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Motor de Transacciones</h1>
        <p className="mt-1 text-gray-600">Visor de órdenes, control de splits de pago y gestión de reembolsos vía Payku.</p>
      </div>

      <TransactionTable
        orders={orders}
        onViewOrder={handleViewOrder}
      />
    </div>
  );
};

export default TransactionEngine;