import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const DashboardBanner: React.FC = () => {
    return (
        <div className="bg-orange-500 text-white px-6 py-4 rounded-lg shadow-md mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <AlertTriangle size={24} className="text-white" />
                <span className="font-medium">
                    ⚠️ Tu cuenta está INACTIVA. Completa los pasos de verificación para empezar a recibir trabajos.
                </span>
            </div>
        </div>
    );
};

export default DashboardBanner;
