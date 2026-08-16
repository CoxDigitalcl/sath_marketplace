const normalizeText = (value) => String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isPlaceholder = (value) => /^\[[^\]]+\]$/.test(String(value || '').trim());

const normalizeHeading = (value) => normalizeText(value).replace(/:$/, '');

export const parsePublicServiceDescription = (value) => {
    const source = String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/\s*(\*\*[^*\n]+:\*\*)\s*/g, '\n$1\n');
    const lines = source.split('\n').map(line => line.trim());
    const sections = [];
    let current = { heading: 'Descripción', paragraphs: [], items: [] };

    const commit = () => {
        if (current.paragraphs.length > 0 || current.items.length > 0) {
            sections.push(current);
        }
    };

    for (const line of lines) {
        if (!line || isPlaceholder(line)) continue;

        const headingMatch = line.match(/^\*\*([^*]+):\*\*$/);
        if (headingMatch) {
            commit();
            current = {
                heading: normalizeHeading(headingMatch[1]),
                paragraphs: [],
                items: []
            };
            continue;
        }

        const itemMatch = line.match(/^[-•]\s+(.+)$/);
        if (itemMatch) {
            const item = normalizeText(itemMatch[1]);
            if (item && !isPlaceholder(item)) current.items.push(item);
            continue;
        }

        const paragraph = normalizeText(line);
        if (paragraph && !isPlaceholder(paragraph)) current.paragraphs.push(paragraph);
    }

    commit();

    if (sections.length === 0) {
        const fallback = normalizeText(value);
        if (fallback && !isPlaceholder(fallback)) {
            sections.push({ heading: 'Descripción', paragraphs: [fallback], items: [] });
        }
    }

    const plainText = sections
        .flatMap(section => [...section.paragraphs, ...section.items])
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        plainText,
        sections: sections.map(section => ({
            heading: section.heading,
            paragraphs: [...section.paragraphs],
            items: [...section.items]
        }))
    };
};

export const getPricingBasisLabel = (pricingType, durationMinutes) => {
    const duration = Number(durationMinutes);
    const suffix = Number.isFinite(duration) && duration > 0 ? ` Duración referencial: ${duration} minutos.` : '';
    const labels = {
        per_hour: 'El precio publicado corresponde a una hora de servicio.',
        per_event: 'El precio publicado corresponde al servicio o evento descrito.',
        fixed: 'El precio publicado corresponde al alcance descrito.'
    };
    return `${labels[pricingType] || 'La base del precio debe confirmarse con el proveedor.'}${suffix}`;
};

export const getAvailabilityLabel = (availabilityType) => ({
    agenda: 'La disponibilidad se confirma en la agenda antes de reservar.',
    immediate: 'El proveedor declara disponibilidad inmediata, sujeta a confirmación.',
    quote: 'La disponibilidad y el valor final se confirman mediante cotización.'
}[availabilityType] || 'La disponibilidad se confirma antes de reservar.');
