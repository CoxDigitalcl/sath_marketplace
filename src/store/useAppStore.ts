import { create } from 'zustand';

type Theme = 'client' | 'provider';

interface AppState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    // Placeholder for Auth State - to be expanded in Phase 2
    user: any | null;
    setUser: (user: any | null) => void;

    isVerificationModalOpen: boolean;
    openVerificationModal: () => void;
    closeVerificationModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    theme: 'client',
    setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
    },
    user: null,
    setUser: (user) => set({ user }),

    // UX: Verification Modal Global State
    isVerificationModalOpen: false,
    openVerificationModal: () => set({ isVerificationModalOpen: true }),
    closeVerificationModal: () => set({ isVerificationModalOpen: false }),
}));
