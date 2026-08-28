import React, { Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    CalendarClock,
    CheckCircle2,
    Eye,
    FileCheck2,
    Info,
    ShieldCheck,
    Tag,
    X
} from 'lucide-react';

interface ServiceModerationCriteriaDrawerProps {
    open: boolean;
    onClose: () => void;
}

interface CriteriaSectionProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    items: string[];
    tone: 'automatic' | 'targeted' | 'full';
}

const TONE_STYLES = {
    automatic: {
        card: 'border-emerald-200 bg-emerald-50/70',
        icon: 'bg-emerald-100 text-emerald-700',
        dot: 'bg-emerald-500'
    },
    targeted: {
        card: 'border-amber-200 bg-amber-50/70',
        icon: 'bg-amber-100 text-amber-800',
        dot: 'bg-amber-500'
    },
    full: {
        card: 'border-violet-200 bg-violet-50/70',
        icon: 'bg-violet-100 text-violet-700',
        dot: 'bg-violet-500'
    }
} as const;

const CriteriaSection: React.FC<CriteriaSectionProps> = ({ icon, title, description, items, tone }) => {
    const styles = TONE_STYLES[tone];
    return (
        <section className={`rounded-2xl border p-4 ${styles.card}`}>
            <div className="flex items-start gap-3">
                <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ${styles.icon}`} aria-hidden="true">
                    {icon}
                </span>
                <div className="min-w-0">
                    <h3 className="font-semibold text-gray-950">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-700">{description}</p>
                </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm leading-5 text-gray-700">
                {items.map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                        <span className={`mt-2 h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`} aria-hidden="true" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
};

const ServiceModerationCriteriaDrawer: React.FC<ServiceModerationCriteriaDrawerProps> = ({ open, onClose }) => {
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    return (
        <Transition show={open} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-[85]"
                initialFocus={closeButtonRef}
                onClose={onClose}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200 motion-reduce:duration-0"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150 motion-reduce:duration-0"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-950/45 backdrop-blur-[1px]" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-3 sm:pl-10">
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-out duration-300 motion-reduce:duration-0"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in duration-200 motion-reduce:duration-0"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="pointer-events-auto flex h-full w-screen max-w-xl flex-col bg-white shadow-2xl">
                                    <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 sm:px-6">
                                        <div className="min-w-0">
                                            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                                <Info size={14} aria-hidden="true" />
                                                Referencia operativa
                                            </div>
                                            <Dialog.Title className="text-xl font-bold text-gray-950 sm:text-2xl">
                                                Criterios de moderación
                                            </Dialog.Title>
                                            <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
                                                Así decide el sistema qué se publica de inmediato y qué necesita revisión administrativa.
                                            </p>
                                        </div>
                                        <button
                                            ref={closeButtonRef}
                                            type="button"
                                            onClick={onClose}
                                            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                                            aria-label="Cerrar criterios de moderación"
                                        >
                                            <X size={22} aria-hidden="true" />
                                        </button>
                                    </header>

                                    <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                                        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
                                            <div className="flex items-start gap-3">
                                                <ShieldCheck className="mt-0.5 flex-none text-sky-700" size={20} aria-hidden="true" />
                                                <p>
                                                    Esta guía refleja la política aplicada por el servidor. Si una edición combina cambios automáticos y revisables, los automáticos se publican y solo la parte sensible queda pendiente.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 space-y-4">
                                            <CriteriaSection
                                                tone="automatic"
                                                icon={<CheckCircle2 size={21} />}
                                                title="Publicación automática"
                                                description="No requiere intervención del administrador y mantiene la autonomía del proveedor."
                                                items={[
                                                    'Precio, forma de cobro, tarifas y distancia máxima de traslado.',
                                                    'Duración, disponibilidad y configuración de agenda.',
                                                    'Ajustes acotados de nombre, descripción o características, siempre que no incorporen contenido sensible.'
                                                ]}
                                            />
                                            <CriteriaSection
                                                tone="targeted"
                                                icon={<Eye size={21} />}
                                                title="Revisión focalizada"
                                                description="El administrador revisa únicamente el recurso o texto que cambió."
                                                items={[
                                                    'Video, portada, imágenes o contenido de la galería.',
                                                    'Texto con enlaces externos, correo, teléfono o referencias a WhatsApp o Telegram.',
                                                    'Texto que propone pagos o coordinación fuera de la plataforma, o cuya modificación es sustancial.'
                                                ]}
                                            />
                                            <CriteriaSection
                                                tone="full"
                                                icon={<FileCheck2 size={21} />}
                                                title="Revisión completa"
                                                description="Se revisa la ficha integral y se exige completar la lista de comprobación."
                                                items={[
                                                    'Creación de un Servicio nuevo.',
                                                    'Cambio de categoría o clasificación.',
                                                    'Cambio de modalidad o tipo de prestación.'
                                                ]}
                                            />
                                        </div>

                                        <section className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                            <h3 className="flex items-center gap-2 font-semibold text-gray-950">
                                                <Tag size={18} className="text-gray-600" aria-hidden="true" />
                                                Qué ocurre mientras se revisa
                                            </h3>
                                            <ul className="mt-3 space-y-3 text-sm leading-6 text-gray-700">
                                                <li className="flex gap-2.5">
                                                    <CalendarClock className="mt-0.5 flex-none text-gray-500" size={18} aria-hidden="true" />
                                                    <span>La versión pública previamente aprobada sigue visible hasta que exista una decisión.</span>
                                                </li>
                                                <li className="flex gap-2.5">
                                                    <ShieldCheck className="mt-0.5 flex-none text-gray-500" size={18} aria-hidden="true" />
                                                    <span>La aprobación o rechazo se vincula a la revisión exacta que el administrador examinó.</span>
                                                </li>
                                            </ul>
                                        </section>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default ServiceModerationCriteriaDrawer;
