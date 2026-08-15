import React, { useEffect, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import HomePage from '../components/HomePage';
import AuthPage from '../components/AuthPage';
import ProviderRegistrationForm from '../components/ProviderRegistrationForm';
import ClientRegistrationForm from '../components/ClientRegistrationForm';
import LoginForm from '../components/LoginForm';
import ForgotPasswordPage from '../components/ForgotPasswordPage';
import ResetPasswordPage from '../components/ResetPasswordPage';
import StyleGuidePage from '../components/StyleGuidePage';
import SearchResultsPage from '../components/public/SearchResultsPage';
import ServiceDetailPage from '../components/public/ServiceDetailPage';
import ProviderPublicProfile from '../components/public/ProviderPublicProfile';
import CheckoutPage from '../components/public/CheckoutPage';
import CheckoutSuccessPage from '../components/public/CheckoutSuccessPage';
import CategoriesHubPage from '../components/public/CategoriesHubPage';
import CategoryDetailPage from '../components/public/CategoryDetailPage';
import LegalPolicy from '../components/public/LegalPolicy';
import WhatsAppWidget from '../components/common/WhatsAppWidget';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../stores/authStore';

const AdminDashboard = React.lazy(() => import('../components/admin/AdminDashboard'));
const ProviderDashboard = React.lazy(() => import('../components/provider/ProviderDashboard'));
const ClientDashboard = React.lazy(() => import('../components/client/ClientDashboard'));

// Route Guard Component
interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: ('client' | 'provider' | 'admin')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'admin') return <Navigate to="/admin" replace />;
        if (user.role === 'provider') return <Navigate to="/provider/dashboard" replace />;
        return <Navigate to="/client/dashboard" replace />;
    }

    return <>{children}</>;
};

// Helper to scroll to top on route change
const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

// Layout Component that includes Header and Footer
const StandardLayout: React.FC<{ children: React.ReactNode, navigateTo: (page: string, params?: any) => void }> = ({ children, navigateTo }) => {
    return (
        <div className="flex flex-col min-h-screen">
            <Header navigateTo={navigateTo} />
            <main className="flex-grow">
                {children}
            </main>
            <Footer navigateTo={navigateTo} />
            <WhatsAppWidget />
        </div>
    );
};

const NotFoundPage: React.FC = () => (
    <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Página no encontrada</h1>
        <p className="mt-4 text-gray-600">
            La dirección solicitada no existe o ya no está disponible.
        </p>
        <a href="/" className="mt-6 inline-flex font-semibold text-brand-primary hover:underline">
            Volver al inicio
        </a>
    </section>
);

const AppRoutes: React.FC = () => {
    const { setTheme } = useAppStore();
    const location = useLocation();
    const navigate = useNavigate();

    // Adapter for legacy 'navigateTo' prop
    const navigateToAdapter = useCallback((page: string, params?: any) => {
        switch (page) {
            case 'home': navigate('/'); break;
            case 'auth': navigate('/auth'); break;
            case 'login': navigate('/login', { state: params }); break;
            case 'provider-register': navigate('/provider/register'); break;
            case 'client-register': navigate('/client/register'); break;
            case 'forgot-password': navigate('/forgot-password'); break;
            case 'reset-password': navigate('/reset-password'); break;
            case 'search': {
                const sp = new URLSearchParams();
                if (params?.q) sp.set('q', params.q);
                if (params?.category) sp.set('category', params.category);
                if (params?.region) sp.set('region', params.region);
                if (params?.region && (params?.communes?.length || params?.commune)) {
                    const communes = Array.isArray(params?.communes) ? params.communes : [params.commune];
                    sp.set('commune', communes.map((commune: unknown) => String(commune).trim()).filter(Boolean).join(','));
                }
                const qs = sp.toString();
                navigate(`/search${qs ? `?${qs}` : ''}`);
                break;
            }
            case 'categories': navigate('/categories'); break;
            case 'category-detail': {
                const sp = new URLSearchParams();
                if (params?.region) sp.set('region', params.region);
                if (params?.region && (params?.communes?.length || params?.commune)) {
                    const communes = Array.isArray(params?.communes) ? params.communes : [params.commune];
                    sp.set('commune', communes.map((commune: unknown) => String(commune).trim()).filter(Boolean).join(','));
                }
                const qs = sp.toString();
                navigate(`/categories/${params?.id}${qs ? `?${qs}` : ''}`, { state: params });
                break;
            }
            case 'service-detail': navigate(`/service/${params?.id}`, { state: params }); break;
            case 'provider-profile': navigate(`/provider/${params?.id || params?.providerId}`, { state: params }); break;
            case 'checkout': navigate('/checkout', { state: params }); break;
            case 'style-guide': navigate('/style-guide'); break;
            case 'admin-dashboard': navigate('/admin'); break;
            case 'provider-dashboard': navigate('/provider/dashboard'); break;
            case 'client-dashboard': navigate('/client/dashboard'); break;
            default: navigate('/');
        }
    }, [navigate]);

    // Theme Sync Logic
    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith('/provider') && !path.includes('public')) {
            setTheme('provider');
        } else if (path.includes('/provider-profile')) {
            setTheme('provider');
        } else {
            setTheme('client');
        }
    }, [location, setTheme]);

    return (
        <>
            <ScrollToTop />
            <React.Suspense fallback={(
                <div className="min-h-screen flex items-center justify-center bg-gray-50">Cargando área privada...</div>
            )}>
              <Routes>
                {/* Dashboards */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/provider/dashboard" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboard /></ProtectedRoute>} />
                <Route path="/client/dashboard" element={<ProtectedRoute allowedRoles={['client']}><ClientDashboard /></ProtectedRoute>} />

                {/* Auth & Registration */}
                <Route path="/auth" element={<StandardLayout navigateTo={navigateToAdapter}><AuthPage navigateTo={navigateToAdapter} /></StandardLayout>} />
                <Route path="/provider/register" element={<ProviderRegistrationForm navigateTo={navigateToAdapter} />} />
                <Route path="/client/register" element={<ClientRegistrationForm navigateTo={navigateToAdapter} />} />
                <Route path="/login" element={<LoginForm navigateTo={navigateToAdapter} />} />
                <Route path="/forgot-password" element={<StandardLayout navigateTo={navigateToAdapter}><ForgotPasswordPage /></StandardLayout>} />
                <Route path="/reset-password" element={<StandardLayout navigateTo={navigateToAdapter}><ResetPasswordPage /></StandardLayout>} />

                {/* Public Pages */}
                <Route path="/" element={<StandardLayout navigateTo={navigateToAdapter}><HomePage navigateTo={navigateToAdapter} setTheme={setTheme} /></StandardLayout>} />
                <Route path="/search" element={<StandardLayout navigateTo={navigateToAdapter}><SearchResultsPage navigateTo={navigateToAdapter} /></StandardLayout>} />
                <Route path="/categories" element={<StandardLayout navigateTo={navigateToAdapter}><CategoriesHubPage navigateTo={navigateToAdapter} /></StandardLayout>} />
                <Route path="/categories/:id" element={<StandardLayout navigateTo={navigateToAdapter}><CategoryDetailPage navigateTo={navigateToAdapter} categoryId={location.pathname.split('/').pop()} categoryName={location.state?.name} /></StandardLayout>} />
                <Route path="/service/:id" element={<StandardLayout navigateTo={navigateToAdapter}><ServiceDetailPage navigateTo={navigateToAdapter} serviceId={location.pathname.split('/').pop()} /></StandardLayout>} />
                <Route path="/provider/:id" element={<StandardLayout navigateTo={navigateToAdapter}><ProviderPublicProfile navigateTo={navigateToAdapter} providerId={location.pathname.split('/').pop()} /></StandardLayout>} />
                <Route path="/checkout" element={<StandardLayout navigateTo={navigateToAdapter}><CheckoutPage navigateTo={navigateToAdapter} service={location.state?.service} booking={location.state?.booking} freightData={location.state?.freightData} /></StandardLayout>} />
                <Route path="/checkout/success" element={<StandardLayout navigateTo={navigateToAdapter}><CheckoutSuccessPage navigateTo={navigateToAdapter} /></StandardLayout>} />
                <Route path="/legal/:slug" element={<StandardLayout navigateTo={navigateToAdapter}><LegalPolicy /></StandardLayout>} />
                <Route path="/style-guide" element={<StandardLayout navigateTo={navigateToAdapter}><StyleGuidePage /></StandardLayout>} />

                {/* Fallback */}
                <Route path="*" element={<StandardLayout navigateTo={navigateToAdapter}><NotFoundPage /></StandardLayout>} />
              </Routes>
            </React.Suspense>
        </>
    );
};

export default AppRoutes;
