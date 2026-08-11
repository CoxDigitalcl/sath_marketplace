import React from 'react';
import { ProviderStatus } from '../../../types';
import { CheckCircle, Clock, Search, XCircle, PauseCircle, AlertOctagon, Ban, UserCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: ProviderStatus;
}

const statusConfig = {
  [ProviderStatus.ACTIVE]: {
    label: 'Activo',
    icon: CheckCircle,
    color: 'text-green-800 bg-green-100',
  },
  [ProviderStatus.PENDING]: {
    label: 'Pendiente',
    icon: Clock,
    color: 'text-gray-800 bg-gray-200',
  },
  [ProviderStatus.IN_REVIEW]: {
    label: 'En Revisión',
    icon: Search,
    color: 'text-blue-800 bg-blue-100',
  },
  [ProviderStatus.APPROVED]: {
    label: 'Aprobado',
    icon: UserCheck,
    color: 'text-cyan-800 bg-cyan-100',
  },
  [ProviderStatus.REJECTED]: {
    label: 'Rechazado',
    icon: XCircle,
    color: 'text-red-800 bg-red-100',
  },
  [ProviderStatus.SUSPENDED]: {
    label: 'Suspendido',
    icon: PauseCircle,
    color: 'text-yellow-800 bg-yellow-100',
  },
  [ProviderStatus.INACTIVE]: {
    label: 'Inactivo',
    icon: AlertOctagon,
    color: 'text-purple-800 bg-purple-100',
  },
  [ProviderStatus.BANNED]: {
    label: 'Baneado',
    icon: Ban,
    color: 'text-black bg-gray-400',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig[ProviderStatus.PENDING];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      <Icon size={14} className="mr-1.5" />
      {config.label}
    </span>
  );
};

export default StatusBadge;
