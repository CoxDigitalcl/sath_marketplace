import React, { useEffect, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorLogProvider from './components/ErrorLogProvider';
import PublicSsrView from '../shared/publicSsrView.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const readPublicSsrPage = (): Record<string, unknown> | undefined => {
  const stateElement = document.getElementById('public-ssr-state');
  if (!stateElement?.textContent) return undefined;

  try {
    return JSON.parse(stateElement.textContent) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const ssrPage = readPublicSsrPage();

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
