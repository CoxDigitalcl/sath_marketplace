
import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';
import ErrorLogConsole from './ErrorLogConsole';

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  stack?: string;
}

interface ErrorLogContextType {
  errors: LogEntry[];
  clearErrors: () => void;
}

const ErrorLogContext = createContext<ErrorLogContextType | undefined>(undefined);

export const useErrorLog = () => {
  const context = useContext(ErrorLogContext);
  if (!context) {
    throw new Error('useErrorLog must be used within an ErrorLogProvider');
  }
  return context;
};

interface ErrorLogProviderProps {
  children: ReactNode;
}

const ErrorLogProvider: React.FC<ErrorLogProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<LogEntry[]>([]);

  const addError = useCallback((message: string, stack?: string) => {
    const newError: LogEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      stack,
    };
    setErrors(prevErrors => [newError, ...prevErrors]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      addError(event.message, event.error?.stack);
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) {
        addError(`Unhandled Promise Rejection: ${reason.message}`, reason.stack);
      } else {
        addError(`Unhandled Promise Rejection: ${String(reason)}`);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [addError]);
  
  const contextValue = { errors, clearErrors };

  return (
    <ErrorLogContext.Provider value={contextValue}>
      {children}
      <ErrorLogConsole />
    </ErrorLogContext.Provider>
  );
};

export default ErrorLogProvider;
