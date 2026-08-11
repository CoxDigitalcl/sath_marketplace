import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import {
    buildWhatsAppUrl,
    normalizeWhatsAppSettings,
    sanitizeWhatsAppPhone,
    WhatsAppSettings,
} from './whatsappConfig';

const WhatsAppWidget: React.FC = () => {
    const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/public/settings/whatsapp');
                if (!response.ok) return;
                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) return;

                const data = await response.json();
                if (isMounted && data.status === 'success') {
                    setSettings(normalizeWhatsAppSettings(data.data));
                }
            } catch (error) {
                console.error('Error fetching WhatsApp settings:', error);
            }
        };

        fetchSettings();

        return () => {
            isMounted = false;
        };
    }, []);

    const activeAgents = useMemo(() => {
        if (!settings?.agents) return [];
        return settings.agents.filter(agent => agent.isActive && sanitizeWhatsAppPhone(agent.phone));
    }, [settings]);

    if (!settings?.enabled || activeAgents.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-5 right-4 sm:right-6 z-40 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-start justify-between gap-4 bg-brand-primary px-5 py-4 text-white">
                            <div>
                                <p className="text-base font-bold leading-tight">{settings.welcomeTitle}</p>
                                <p className="mt-1 text-xs text-white/80">{settings.buttonText}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
                                aria-label="Cerrar WhatsApp"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {activeAgents.map(agent => (
                                <a
                                    key={agent.id}
                                    href={buildWhatsAppUrl(agent)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 px-5 py-4 transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                                >
                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-brand-primary/10 text-brand-primary">
                                        {agent.avatarUrl ? (
                                            <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                                                {agent.initials || 'WA'}
                                            </div>
                                        )}
                                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#25D366]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-gray-900">{agent.name}</p>
                                        <p className="truncate text-xs text-gray-500">{agent.role || 'WhatsApp'}</p>
                                    </div>
                                    <MessageCircle size={19} className="flex-shrink-0 text-[#25D366]" />
                                </a>
                            ))}
                        </div>

                        {settings.footerText && (
                            <div className="bg-gray-50 px-5 py-3 text-xs text-gray-500">
                                {settings.footerText}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="group inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/20 transition hover:-translate-y-0.5 hover:bg-[#1ebe5d] focus:outline-none focus:ring-4 focus:ring-green-200"
                aria-expanded={isOpen}
                aria-label="Abrir WhatsApp"
            >
                <MessageCircle size={22} />
                <span className="hidden sm:inline">{settings.buttonText}</span>
            </button>
        </div>
    );
};

export default WhatsAppWidget;
