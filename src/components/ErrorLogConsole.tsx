
import React, { useState } from 'react';
import { useErrorLog } from './ErrorLogProvider';
import { ShieldAlert, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ErrorLogConsole: React.FC = () => {
  const { errors, clearErrors } = useErrorLog();
  const [isOpen, setIsOpen] = useState(false);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-80 h-96 sm:w-96 bg-white rounded-lg shadow-2xl border border-gray-300 flex flex-col"
          >
            <header className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="text-red-500" size={20} />
                <h2 className="font-bold text-gray-800">Error Log ({errors.length})</h2>
              </div>
              <button
                onClick={clearErrors}
                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                aria-label="Clear errors"
              >
                <Trash2 size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {errors.map(error => (
                <div key={error.id} className="bg-red-50 p-2 rounded-md border border-red-200 text-sm">
                  <p className="font-semibold text-red-800">
                    <span className="font-mono text-xs text-gray-500 mr-2">{error.timestamp}</span>
                    {error.message}
                  </p>
                  {error.stack && (
                    <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap break-all bg-red-100 p-2 rounded font-mono">
                      <code>{error.stack}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="mt-2 w-full flex items-center justify-between py-2 px-4 bg-red-600 text-white font-bold rounded-full shadow-lg hover:bg-red-700 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center">
            <ShieldAlert size={20} className="mr-2" />
            <span>{errors.length} Error{errors.length > 1 ? 's' : ''}</span>
        </div>
        {isOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </motion.button>
    </div>
  );
};

export default ErrorLogConsole;
