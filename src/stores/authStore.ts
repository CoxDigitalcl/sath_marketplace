import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';

export type UserRole = 'client' | 'provider' | 'admin';

interface User {
    id: string;
    email: string;
    role: UserRole;
    full_name?: string; // Optional populated field
    profile_image_url?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isSessionExpired: boolean;

    // Actions
    login: (token: string, user: User) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
    setSessionExpired: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            isSessionExpired: false,

            login: (token, user) => {
                // Save to localStorage for Axios Interceptor
                localStorage.setItem('auth_token', token);

                set({
                    user,
                    token,
                    isAuthenticated: true,
                    isSessionExpired: false,
                });
            },

            logout: () => {
                localStorage.removeItem('auth_token');
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
        }),
        {
            name: 'auth-storage', // Key in localStorage
            partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }), // Persist only these
        }
    )
);
