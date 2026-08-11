import React from 'react';
import { CheckCircle, Circle, ArrowRight, UserCheck, Briefcase, CreditCard, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
// import { motion } from 'framer-motion';

interface OnboardingStatus {
    isVerified: boolean;
    hasServices: boolean;
    hasKycDocs: boolean;
    hasBankDetails: boolean;
}

interface ActivationChecklistProps {
    status: OnboardingStatus;
    navigateTo: (view: string) => void;
}

const ActivationChecklist: React.FC<ActivationChecklistProps> = ({ status, navigateTo }) => {
    // Calculate progress
    const steps = [
        { id: 'register', label: 'Registro Básico', completed: true, icon: UserCheck, link: null },
        { id: 'kyc', label: 'Verificar Identidad y Documentos (KYC)', completed: status.hasKycDocs, icon: UserCheck, link: 'profile', priority: true },
        { id: 'services', label: 'Definir Categorías y Servicios', completed: status.hasServices, icon: Briefcase, link: 'services' },
        { id: 'bank', label: 'Datos Bancarios', completed: status.hasBankDetails, icon: CreditCard, link: 'profile' },
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const totalSteps = steps.length;
    const progress = Math.round((completedCount / totalSteps) * 100);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                🚀 Guía de Activación de Cuenta
            </h3>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{progress}% Completado</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                        className="bg-brand-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-4">
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-colors gap-3 sm:gap-0 ${step.completed
                            ? 'bg-green-50 border-green-200'
                            : step.priority
                                ? 'bg-orange-50 border-orange-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                    >
                        <div className="flex items-start sm:items-center space-x-4">
                            {step.completed ? (
                                <CheckCircle className="text-green-500 h-6 w-6 flex-shrink-0 mt-0.5 sm:mt-0" />
                            ) : (
                                step.priority ? (
                                    <div className="h-6 w-6 rounded-full border-2 border-orange-500 flex items-center justify-center bg-orange-100 text-orange-600 font-bold text-xs flex-shrink-0 mt-0.5 sm:mt-0">!</div>
                                ) : (
                                    <Circle className="text-gray-400 h-6 w-6 flex-shrink-0 mt-0.5 sm:mt-0" />
                                )
                            )}

                            <div>
                                <h4 className={`font-medium ${step.completed ? 'text-green-800' : 'text-gray-800'}`}>
                                    {step.label}
                                    {step.priority && !step.completed && (
                                        <span className="ml-2 inline-block text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200 mt-1 sm:mt-0">
                                            Pendiente (Prioritario)
                                        </span>
                                    )}
                                    {step.completed && (
                                        <span className="ml-2 inline-block text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full mt-1 sm:mt-0">
                                            Completado
                                        </span>
                                    )}
                                </h4>
                            </div>
                        </div>

                        {/* Action Button */}
                        {!step.completed && step.link && (
                            <div className="pl-10 sm:pl-0 sm:ml-4 flex-shrink-0">
                                <button onClick={() => navigateTo(step.link!)} className="flex items-center text-sm font-medium text-brand-primary bg-white border border-brand-primary px-3 py-1.5 rounded hover:bg-brand-primary hover:text-white transition-colors w-full sm:w-auto justify-center">
                                    Configurar <ChevronRight size={16} className="ml-1" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActivationChecklist;
