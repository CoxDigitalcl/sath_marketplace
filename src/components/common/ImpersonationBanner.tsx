import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const ImpersonationBanner: React.FC = () => {
    const { user, logout, returnToAdmin } = useAuthStore();
    if (!user?.impersonatedBy) return null;

    return (
        <div className="sticky top-0 z-[100] flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <span>Sesión temporal de soporte activa como {user.email}.</span>
            <button
                type="button"
                onClick={() => {
                    if (returnToAdmin()) {
                        window.location.assign('/admin');
                        return;
                    }
                    logout();
                    window.location.assign('/login');
                }}
                className="rounded bg-amber-950 px-3 py-1 text-xs text-white hover:bg-black"
            >
                Volver a administración
            </button>
        </div>
    );
};

export default ImpersonationBanner;
