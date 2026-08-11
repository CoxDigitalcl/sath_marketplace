import React from 'react';
import { OrderStatus, PayoutStatus } from '../../../types';
import { CheckCircle, Clock, XCircle, Undo, Loader, CalendarCheck, Send, AlertTriangle } from 'lucide-react';

interface BadgeProps {
    status: OrderStatus | PayoutStatus;
    type: 'order' | 'payout';
}

const orderStatusConfig = {
    [OrderStatus.COMPLETED]: { label: 'Completada', icon: CheckCircle, color: 'text-green-800 bg-green-100' },
    [OrderStatus.PENDING_PAYMENT]: { label: 'Pendiente de Pago', icon: Clock, color: 'text-yellow-800 bg-yellow-100' },
    [OrderStatus.AUTHORIZED]: { label: 'Autorizada', icon: Loader, color: 'text-blue-800 bg-blue-100' },
    [OrderStatus.CANCELLED]: { label: 'Cancelada', icon: XCircle, color: 'text-gray-800 bg-gray-200' },
    [OrderStatus.REFUNDED]: { label: 'Reembolsada', icon: Undo, color: 'text-red-800 bg-red-100' },
};

const payoutStatusConfig = {
    [PayoutStatus.NONE]: { label: 'N/A', icon: XCircle, color: 'text-gray-800 bg-gray-200' },
    [PayoutStatus.PAYKU_SCHEDULED]: { label: 'Programado', icon: CalendarCheck, color: 'text-blue-800 bg-blue-100' },
    [PayoutStatus.PAYKU_PAID]: { label: 'Pagado', icon: Send, color: 'text-green-800 bg-green-100' },
    [PayoutStatus.PAYKU_FAILED]: { label: 'Fallido', icon: AlertTriangle, color: 'text-red-800 bg-red-100' },
};

const TransactionStatusBadge: React.FC<BadgeProps> = ({ status, type }) => {
    const config = type === 'order' 
        ? orderStatusConfig[status as OrderStatus] 
        : payoutStatusConfig[status as PayoutStatus];

    if (!config) {
        return null;
    }

    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            <Icon size={14} className="mr-1.5" />
            {config.label}
        </span>
    );
};

export default TransactionStatusBadge;