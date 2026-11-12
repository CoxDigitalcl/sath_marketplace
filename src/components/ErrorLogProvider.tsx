
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

const isKnownWebKitMediaError = (event: ErrorEvent): boolean => {
  const messagePattern = /^(?:ReferenceError: )?Can't find variable: EmptyRanges$/;
  if (event.filename || !messagePattern.test(event.message) || typeof event.error?.stack !== 'string') {
    return false;
  }

  // WebKit #318284 originates inside native media controls, without a script URL.
  const frames = event.error.stack.trim().split(/\r?\n/);
  const nativeFrame = /^(played|buffered|seekable|endTimeForBufferedRangeContainingCurrentTime|syncControl|handleEvent)@(?:\[native code\])?$/;
  return frames.some(frame => /^(played|buffered|seekable)@/.test(frame)) &&
    frames.some(frame => /^syncControl@/.test(frame)) &&
    frames.some(frame => /^handleEvent@/.test(frame)) &&
    frames.every(frame => nativeFrame.test(frame) || messagePattern.test(frame));
};

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
      if (isKnownWebKitMediaError(event)) return;
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
