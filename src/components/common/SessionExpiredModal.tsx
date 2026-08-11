import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Clock, LogOut, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const SessionExpiredModal: React.FC = () => {
    const { isSessionExpired, setSessionExpired, logout } = useAuthStore();

    const handleLoginRedirect = () => {
        setSessionExpired(false);
        logout();
        window.location.href = '/login';
    };

    const handleDismiss = () => {
        // Clear the expired session state and let user continue browsing as anonymous
        setSessionExpired(false);
        logout(); // Clean up stale auth data
    };

    return (
        <Transition show={isSessionExpired} as={Fragment}>
            {/* Using a high z-index to ensure it opens on top of everything, including other modals */}
            <Dialog as="div" className="relative z-[100]" onClose={handleDismiss}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-[101] w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-gray-100">
                                {/* Close button */}
                                <button
                                    onClick={handleDismiss}
                                    className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
                                    aria-label="Cerrar"
                                >
                                    <X size={18} />
                                </button>

                                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start text-center sm:text-left flex-col sm:flex-row items-center sm:items-start">
                                        <div className="mx-auto flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-red-50 sm:mx-0 sm:h-12 sm:w-12 border border-red-100">
                                            <Clock className="h-6 w-6 text-red-600" aria-hidden="true" />
                                        </div>
                                        <div className="mt-4 sm:ml-4 sm:mt-0 text-center sm:text-left">
                                            <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                                                Sesión Expirada
                                            </Dialog.Title>
                                            <div className="mt-3">
                                                <p className="text-sm text-gray-600">
                                                    Tu sesión ha caducado por seguridad o inactividad. Puedes iniciar sesión nuevamente o continuar navegando como visitante.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:px-6 border-t border-gray-100">
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto transition-all"
                                        onClick={handleDismiss}
                                    >
                                        Continuar navegando
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90 sm:w-auto transition-all items-center space-x-2 group"
                                        onClick={handleLoginRedirect}
                                    >
                                        <LogOut size={16} />
                                        <span>Ir a Iniciar Sesión</span>
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default SessionExpiredModal;
