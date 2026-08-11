import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';

const VerificationModal: React.FC = () => {
    const { isVerificationModalOpen, closeVerificationModal } = useAppStore();
    const navigate = useNavigate();

    const handleGoToProfile = () => {
        closeVerificationModal();
        navigate('/provider/dashboard');
        // Ideally navigate directly to profile view if supported, e.g. /provider/dashboard?view=profile
        // For now, dashboard is fine, user can click profile.
        setTimeout(() => {
            // Dispatch event or use store to switch active view if possible
            // For simplicity, we just go to dashboard.
        }, 100);
    };

    return (
        <Transition show={isVerificationModalOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[60]" onClose={closeVerificationModal}>
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

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-100">
                                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mx-auto flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-orange-50 sm:mx-0 sm:h-12 sm:w-12 border border-orange-100">
                                            <div className="relative">
                                                <ShieldCheck className="h-8 w-8 text-brand-primary" aria-hidden="true" />
                                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-gray-100">
                                                    <Lock className="h-3 w-3 text-gray-500" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 text-center sm:ml-4 sm:mt-0 sm:text-left">
                                            <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                                                Verificación Requerida
                                            </Dialog.Title>
                                            <div className="mt-3">
                                                <p className="text-sm text-gray-600 mb-3">
                                                    Para acceder a funciones financieras y aceptar trabajos, necesitamos verificar tu identidad. Esto garantiza la seguridad y confianza en nuestra comunidad.
                                                </p>
                                                <ul className="text-sm text-gray-500 space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <li className="flex items-center space-x-2">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary"></span>
                                                        <span>Sube tu documento de identidad</span>
                                                    </li>
                                                    <li className="flex items-center space-x-2">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary"></span>
                                                        <span>Verifica tus antecedentes</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-100">
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 sm:ml-3 sm:w-auto transition-all items-center space-x-2 group"
                                        onClick={handleGoToProfile}
                                    >
                                        <span>Completar Verificación</span>
                                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-all"
                                        onClick={closeVerificationModal}
                                    >
                                        Ahora no
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

export default VerificationModal;
