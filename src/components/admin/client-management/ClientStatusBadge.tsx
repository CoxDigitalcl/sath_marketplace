import React from 'react';
import { ClientStatus } from '../../../types';
import { Clock, UserCheck, UserPlus, AlertCircle, ShieldOff, Moon } from 'lucide-react';

interface StatusBadgeProps {
  status: ClientStatus;
}

const statusConfig = {
  [ClientStatus.PENDIENTE]: {
    label: 'Pendiente',
    icon: Clock,
    color: 'text-gray-800 bg-gray-200',
  },
  [ClientStatus.REGISTRADO]: {
    label: 'Registrado',
    icon: UserPlus,
    color: 'text-blue-800 bg-blue-100',
  },
  [ClientStatus.VERIFICADO]: {
    label: 'Verificado',
    icon: UserCheck,
    color: 'text-green-800 bg-green-100',
  },
  [ClientStatus.SOSPECHOSO]: {
    label: 'Sospechoso',
    icon: AlertCircle,
    color: 'text-yellow-800 bg-yellow-100',
  },
  [ClientStatus.BLOQUEADO]: {
    label: 'Bloqueado',
    icon: ShieldOff,
    color: 'text-red-800 bg-red-100',
  },
  [ClientStatus.INACTIVO]: {
    label: 'Inactivo',
    icon: Moon,
    color: 'text-purple-800 bg-purple-100',
  },
};

const ClientStatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig[ClientStatus.PENDIENTE];
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

export default ClientStatusBadge;
