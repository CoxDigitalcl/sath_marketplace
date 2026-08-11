import axios from 'axios';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../stores/authStore';

// Create Axios Instance
// In Production (same domain), relative URL '/api' works perfectly.
// In Dev, we rely on Vite Proxy or CORS.
export const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        // Get token from LocalStorage (or AuthStore)
        // We access localStorage directly here as a failsafe
        const token = localStorage.getItem('auth_token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle Errors (Global Toast?)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Check for 403 KYC_REQUIRED
        if (error.response && error.response.status === 403 && error.response.data?.code === 'KYC_REQUIRED') {
            useAppStore.getState().openVerificationModal();
        }

        // Check for 401 or 403 (Invalid/expired token)
        // CRITICAL: Only show session expired if user actually HAD a session.
        // Anonymous users browsing without auth should never see this modal.
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            const msg = error.response.data?.message || '';
            const authState = useAuthStore.getState();
            const hadActiveSession = authState.isAuthenticated && authState.token;

            if (hadActiveSession && (error.response.status === 401 || msg.toLowerCase().includes('token'))) {
                 useAuthStore.getState().setSessionExpired(true);
            }
        }
        return Promise.reject(error);
    }
);
