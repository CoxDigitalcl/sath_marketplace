type ConversionValue = string | number | boolean | null;

type ConversionContext = Record<string, ConversionValue | undefined>;

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

const sanitizeContext = (context: ConversionContext) => Object.fromEntries(
    Object.entries(context)
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null)
        .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value])
);

export const trackConversion = (eventName: string, context: ConversionContext = {}) => {
    if (typeof window === 'undefined') return;

    const event = String(eventName || '').replace(/[^a-z0-9_]/gi, '').slice(0, 64);
    if (!event) return;

    const detail = {
        event,
        route: window.location.pathname,
        ...sanitizeContext(context)
    };

    window.dispatchEvent(new CustomEvent('sath:conversion', { detail }));
    if (typeof window.gtag === 'function') {
        window.gtag('event', event, detail);
    }
};
