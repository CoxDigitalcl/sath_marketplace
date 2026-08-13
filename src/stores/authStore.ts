import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UserRole = 'client' | 'provider' | 'admin';

const ADMIN_RETURN_SESSION_KEY = 'admin-return-session';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    full_name?: string;
    profile_image_url?: string;
    impersonatedBy?: string;
    impersonationExpiresAt?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isSessionExpired: boolean;

    login: (token: string, user: User) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
    setSessionExpired: (status: boolean) => void;
    beginImpersonation: (token: string, user: User) => void;
    returnToAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            isSessionExpired: false,

            login: (token, user) => {
                // Interim Stage 4B boundary: credentials expire with the browser tab.
                sessionStorage.setItem('auth_token', token);
                sessionStorage.removeItem(ADMIN_RETURN_SESSION_KEY);

                set({
                    user,
                    token,
                    isAuthenticated: true,
                    isSessionExpired: false,
                });
            },

            logout: () => {
                const activeToken = sessionStorage.getItem('auth_token');
                const isImpersonating = Boolean(get().user?.impersonatedBy);
                if (activeToken && !isImpersonating) {
                    fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${activeToken}` },
                        keepalive: true
                    }).catch(() => {
                        // Local logout still succeeds; the short token expires server-side.
                    });
                }
                sessionStorage.removeItem('auth_token');
                sessionStorage.removeItem(ADMIN_RETURN_SESSION_KEY);
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isSessionExpired: false,
                });
            },

            updateUser: (updates) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null,
                }));
            },

            setSessionExpired: (status) => set({ isSessionExpired: status }),

            beginImpersonation: (token, user) => {
                const current = get();
                if (!current.token || !current.user || current.user.role !== 'admin' || !user.impersonatedBy) {
                    throw new Error('No existe una sesión administrativa válida para iniciar soporte.');
                }
                sessionStorage.setItem(ADMIN_RETURN_SESSION_KEY, JSON.stringify({
                    token: current.token,
                    user: current.user
                }));
                sessionStorage.setItem('auth_token', token);
                set({
                    user,
                    token,
                    isAuthenticated: true,
                    isSessionExpired: false
                });
            },

            returnToAdmin: () => {
                const raw = sessionStorage.getItem(ADMIN_RETURN_SESSION_KEY);
                sessionStorage.removeItem(ADMIN_RETURN_SESSION_KEY);
                if (!raw) return false;

                try {
                    const saved = JSON.parse(raw) as { token?: unknown; user?: Partial<User> };
                    if (typeof saved.token !== 'string' || !saved.token || saved.user?.role !== 'admin'
                        || typeof saved.user.id !== 'string' || typeof saved.user.email !== 'string') {
                        return false;
                    }
                    sessionStorage.setItem('auth_token', saved.token);
                    set({
                        user: saved.user as User,
                        token: saved.token,
                        isAuthenticated: true,
                        isSessionExpired: false
                    });
                    return true;
                } catch {
                    return false;
                }
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
        }
    )
);
