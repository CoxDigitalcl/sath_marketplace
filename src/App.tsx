import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import AppRoutes from './routes/AppRoutes';
import ErrorLogConsole from './components/ErrorLogConsole';
import VerificationModal from './components/common/VerificationModal';
import SessionExpiredModal from './components/common/SessionExpiredModal';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import { Toaster } from 'react-hot-toast';

// Fallback component for Error Boundary
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-red-100">
        <h2 className="text-2xl font-bold text-red-600 mb-4">¡Ups! Algo salió mal.</h2>
        <p className="text-gray-600 mb-6">Ha ocurrido un error inesperado en la aplicación.</p>
        <pre className="text-xs bg-gray-100 p-4 rounded text-left overflow-auto mb-6 text-gray-800 border border-gray-200">
          {error.message}
        </pre>
        <button
          onClick={resetErrorBoundary}
          className="bg-brand-primary text-white font-bold py-2 px-6 rounded-full hover:bg-opacity-90 transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.href = '/'}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <ImpersonationBanner />
        <AppRoutes />
        <VerificationModal />
        <SessionExpiredModal />
        {/* Helper for dev debugging */}
        <div className="fixed bottom-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
          <ErrorLogConsole />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
