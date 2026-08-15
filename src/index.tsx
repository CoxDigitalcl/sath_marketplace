import React, { useEffect, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorLogProvider from './components/ErrorLogProvider';
import PublicSsrView from '../shared/publicSsrView.js';

declare global {
  interface Window {
    __PUBLIC_SSR__?: Record<string, unknown>;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const ssrPage = window.__PUBLIC_SSR__;

const HydrationBootstrap: React.FC = () => {
  const [showApplication, setShowApplication] = useState(!ssrPage);

  useEffect(() => {
    if (ssrPage) setShowApplication(true);
  }, []);

  if (!showApplication && ssrPage) {
    return <PublicSsrView page={ssrPage} />;
  }

  return (
    <ErrorLogProvider>
      <App />
    </ErrorLogProvider>
  );
};

const application = (
  <React.StrictMode>
    <HydrationBootstrap />
  </React.StrictMode>
);

if (ssrPage && rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, application);
} else {
  createRoot(rootElement).render(application);
}
