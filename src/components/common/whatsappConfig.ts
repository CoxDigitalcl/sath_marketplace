export interface WhatsAppAgent {
    id: string;
    name: string;
    role: string;
    phone: string;
    initials: string;
    welcomeMessage: string;
    avatarUrl: string;
    isActive: boolean;
}

export interface WhatsAppSettings {
    enabled: boolean;
    welcomeTitle: string;
    buttonText: string;
    footerText: string;
    agents: WhatsAppAgent[];
}

const DEFAULT_AGENT: WhatsAppAgent = {
    id: 'default-support',
    name: 'Soporte Serviciosatuhogar',
    role: 'Atencion al cliente',
    phone: '',
    initials: 'SH',
    welcomeMessage: 'Hola, necesito ayuda con Serviciosatuhogar.',
    avatarUrl: '',
    isActive: true,
};

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
    enabled: false,
    welcomeTitle: 'Hablemos por WhatsApp',
    buttonText: 'Necesitas ayuda?',
    footerText: 'El equipo suele responder en unos minutos.',
    agents: [DEFAULT_AGENT],
};

const parseMaybeJson = <T,>(value: unknown, fallback: T): T => {
    if (value === undefined || value === null) return fallback;

    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return value as T;
        }
    }

    return value as T;
};

const asString = (value: unknown, fallback: string) => {
    const parsed = parseMaybeJson(value, fallback);
    return typeof parsed === 'string' ? parsed : fallback;
};

const asBoolean = (value: unknown, fallback: boolean) => {
    const parsed = parseMaybeJson(value, fallback);
    if (typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'string') return parsed === 'true';
    return fallback;
};

const makeAgentId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `agent-${Date.now()}`;
};

export const getInitialsFromName = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'WA';
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

export const createWhatsAppAgent = (): WhatsAppAgent => ({
    id: makeAgentId(),
    name: '',
    role: '',
    phone: '',
    initials: '',
    welcomeMessage: 'Hola, necesito ayuda.',
    avatarUrl: '',
    isActive: true,
});

export const normalizeWhatsAppSettings = (raw: Record<string, unknown> | null | undefined): WhatsAppSettings => {
    const source = raw || {};
    const hasAgentsSetting = Object.prototype.hasOwnProperty.call(source, 'agents');
    const parsedAgents = hasAgentsSetting
        ? parseMaybeJson(source.agents, [])
        : DEFAULT_WHATSAPP_SETTINGS.agents;
    const agents = Array.isArray(parsedAgents)
        ? parsedAgents.map((agent, index) => {
            const item = agent as Partial<WhatsAppAgent>;
            const name = String(item.name || '');
            return {
                id: String(item.id || `agent-${index}`),
                name,
                role: String(item.role || ''),
                phone: String(item.phone || ''),
                initials: String(item.initials || getInitialsFromName(name)).slice(0, 3).toUpperCase(),
                welcomeMessage: String(item.welcomeMessage || DEFAULT_AGENT.welcomeMessage),
                avatarUrl: String(item.avatarUrl || ''),
                isActive: item.isActive !== false,
            };
        })
        : DEFAULT_WHATSAPP_SETTINGS.agents;

    return {
        enabled: asBoolean(source.enabled, DEFAULT_WHATSAPP_SETTINGS.enabled),
        welcomeTitle: asString(source.welcomeTitle, DEFAULT_WHATSAPP_SETTINGS.welcomeTitle),
        buttonText: asString(source.buttonText, DEFAULT_WHATSAPP_SETTINGS.buttonText),
        footerText: asString(source.footerText, DEFAULT_WHATSAPP_SETTINGS.footerText),
        agents,
    };
};

export const sanitizeWhatsAppPhone = (phone: string) => phone.replace(/[^\d]/g, '');

export const buildWhatsAppUrl = (agent: WhatsAppAgent) => {
    const phone = sanitizeWhatsAppPhone(agent.phone);
    const text = encodeURIComponent(agent.welcomeMessage || DEFAULT_AGENT.welcomeMessage);
    return `https://wa.me/${phone}?text=${text}`;
};
