const AUTO_APPLY = 'auto_apply';
const TEXT_GUARDED = 'text_guarded';
const TARGETED_REVIEW = 'targeted_review';
const FULL_REVIEW = 'full_review';

const JSON_FIELDS = new Set([
    'calendar_config',
    'features',
    'image_urls',
    'categories_json',
    'gallery_media',
]);

export const SERVICE_FIELD_POLICY = Object.freeze({
    title: TEXT_GUARDED,
    description: TEXT_GUARDED,
    category: FULL_REVIEW,
    price: AUTO_APPLY,
    video_url: TARGETED_REVIEW,
    duration_minutes: AUTO_APPLY,
    type: FULL_REVIEW,
    availability_type: AUTO_APPLY,
    calendar_config: AUTO_APPLY,
    features: TEXT_GUARDED,
    image_urls: TARGETED_REVIEW,
    categories_json: FULL_REVIEW,
    cover_image_url: TARGETED_REVIEW,
    gallery_media: TARGETED_REVIEW,
    pricing_type: AUTO_APPLY,
    freight_base_price: AUTO_APPLY,
    freight_price_per_km: AUTO_APPLY,
    freight_max_distance_km: AUTO_APPLY,
});

export const SERVICE_CHANGE_FIELDS = Object.freeze(Object.keys(SERVICE_FIELD_POLICY));
export const SERVICE_PRICING_FIELDS = Object.freeze([
    'price',
    'pricing_type',
    'freight_base_price',
    'freight_price_per_km',
]);

const SERVICE_CHANGE_FIELD_SET = new Set(SERVICE_CHANGE_FIELDS);
const SERVICE_PRICING_FIELD_SET = new Set(SERVICE_PRICING_FIELDS);

const CONTACT_PATTERNS = Object.freeze([
    { code: 'TEXT_EXTERNAL_LINK', pattern: /(?:https?:\/\/|www\.)\S+/iu },
    { code: 'TEXT_CONTACT_INFORMATION', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu },
    { code: 'TEXT_CONTACT_INFORMATION', pattern: /(?:\+?56\s*)?(?:9\s*)?(?:\d[\s.-]*){8}\b/u },
    { code: 'TEXT_OFF_PLATFORM_TRANSACTION', pattern: /\b(?:whats?app|telegram|pago\s+directo|transferencia\s+directa|fuera\s+de\s+la\s+plataforma)\b/iu },
]);

const isPlainObject = (value) =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stableJson = (value) => {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (isPlainObject(value)) {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableJson(value[key])}`
        ).join(',')}}`;
    }
    return JSON.stringify(value);
};

const parseJsonField = (value) => {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const normalizeFieldValue = (field, value) => {
    if (value === undefined) return undefined;
    if (JSON_FIELDS.has(field)) return parseJsonField(value);
    return value;
};

const valuesEqual = (left, right) => stableJson(left) === stableJson(right);

const collectText = (value) => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join(' ');
    if (isPlainObject(value)) return Object.values(value).map(collectText).filter(Boolean).join(' ');
    return '';
};

const normalizeComparableText = (value) => collectText(value)
    .normalize('NFKC')
    .toLocaleLowerCase('es-CL')
    .replace(/\s+/gu, ' ')
    .trim();

const editDistance = (left, right) => {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[right.length];
};

const removeCommonAffixes = (left, right) => {
    let prefixLength = 0;
    const shortest = Math.min(left.length, right.length);
    while (prefixLength < shortest && left[prefixLength] === right[prefixLength]) prefixLength += 1;

    let leftEnd = left.length;
    let rightEnd = right.length;
    while (
        leftEnd > prefixLength &&
        rightEnd > prefixLength &&
        left[leftEnd - 1] === right[rightEnd - 1]
    ) {
        leftEnd -= 1;
        rightEnd -= 1;
    }

    return [left.slice(prefixLength, leftEnd), right.slice(prefixLength, rightEnd)];
};

const isSubstantialTextChange = (field, beforeValue, proposedValue) => {
    if (field === 'features') return false;

    const before = normalizeComparableText(beforeValue);
    const proposed = normalizeComparableText(proposedValue);
    const longest = Math.max(before.length, proposed.length);
    if (longest === 0) return false;

    const [changedBefore, changedProposed] = removeCommonAffixes(before, proposed);
    if (changedBefore.length * changedProposed.length > 250_000) return true;

    const distance = editDistance(changedBefore, changedProposed);
    const ratio = distance / longest;
    if (field === 'title') return distance >= 3 && ratio > 0.45;
    return distance >= 240 ||
        (distance >= 30 && ratio > 0.45) ||
        (distance >= 8 && ratio > 0.7);
};

export class ServiceChangePolicyError extends Error {
    constructor(code, message, statusCode = 400, details = undefined) {
        super(message);
        this.name = 'ServiceChangePolicyError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

export const assertKnownServiceChangeFields = (proposedChanges) => {
    if (!isPlainObject(proposedChanges)) {
        throw new ServiceChangePolicyError(
            'INVALID_SERVICE_CHANGES',
            'Los cambios del Servicio deben enviarse como un objeto.',
            400
        );
    }

    const unknownFields = Object.keys(proposedChanges)
        .filter((field) => !SERVICE_CHANGE_FIELD_SET.has(field))
        .sort();

    if (unknownFields.length > 0) {
        throw new ServiceChangePolicyError(
            'UNKNOWN_SERVICE_FIELDS',
            'La solicitud contiene campos de Servicio que no están permitidos.',
            400,
            { fields: unknownFields }
        );
    }

    return proposedChanges;
};

export const snapshotServiceFields = (service = {}) => Object.fromEntries(
    SERVICE_CHANGE_FIELDS
        .filter((field) => Object.hasOwn(service, field) && service[field] !== undefined)
        .map((field) => [field, normalizeFieldValue(field, service[field])])
);

export const evaluateTextChange = ({ field, beforeValue, proposedValue }) => {
    const text = collectText(proposedValue);
    const reasons = [];

    for (const { code, pattern } of CONTACT_PATTERNS) {
        if (pattern.test(text) && !reasons.includes(code)) reasons.push(code);
    }

    if (isSubstantialTextChange(field, beforeValue, proposedValue)) {
        reasons.push('TEXT_SUBSTANTIAL_CHANGE');
    }

    return {
        requiresReview: reasons.length > 0,
        reasons,
    };
};

const changedFieldNames = (beforeSnapshot, proposedSnapshot) => SERVICE_CHANGE_FIELDS.filter((field) =>
    !valuesEqual(beforeSnapshot[field], proposedSnapshot[field])
);

export const classifyServiceChanges = ({
    currentService,
    proposedChanges = {},
    revisionType = 'update',
}) => {
    if (!isPlainObject(currentService)) {
        throw new ServiceChangePolicyError(
            'INVALID_CURRENT_SERVICE',
            'No existe una versión pública válida del Servicio.',
            500
        );
    }
    assertKnownServiceChangeFields(proposedChanges);
    if (!['creation', 'update'].includes(revisionType)) {
        throw new ServiceChangePolicyError(
            'INVALID_SERVICE_REVISION_TYPE',
            'El tipo de revisión del Servicio no es válido.',
            400
        );
    }

    const publicSnapshot = snapshotServiceFields(currentService);
    const proposedSnapshot = {
        ...publicSnapshot,
        ...Object.fromEntries(
            Object.entries(proposedChanges)
                .filter(([, value]) => value !== undefined)
                .map(([field, value]) => [field, normalizeFieldValue(field, value)])
        ),
    };

    const changedFields = revisionType === 'creation'
        ? SERVICE_CHANGE_FIELDS.filter((field) => field !== 'is_active' && proposedSnapshot[field] !== undefined)
        : changedFieldNames(publicSnapshot, proposedSnapshot);

    const autoAppliedFields = [];
    const pendingFields = [];
    const reviewReasons = [];
    let reviewScope = 'none';

    for (const field of changedFields) {
        if (revisionType === 'creation') {
            pendingFields.push(field);
            reviewReasons.push({ field, code: 'NEW_SERVICE_REVIEW' });
            reviewScope = 'full';
            continue;
        }

        const policy = SERVICE_FIELD_POLICY[field];
        if (policy === AUTO_APPLY) {
            autoAppliedFields.push(field);
            continue;
        }
        if (policy === TEXT_GUARDED) {
            const evaluation = evaluateTextChange({
                field,
                beforeValue: publicSnapshot[field],
                proposedValue: proposedSnapshot[field],
            });
            if (!evaluation.requiresReview) {
                autoAppliedFields.push(field);
                continue;
            }
            pendingFields.push(field);
            reviewReasons.push(...evaluation.reasons.map((code) => ({ field, code })));
            if (reviewScope === 'none') reviewScope = 'targeted';
            continue;
        }
        if (policy === TARGETED_REVIEW) {
            pendingFields.push(field);
            reviewReasons.push({ field, code: 'MEDIA_CHANGED' });
            if (reviewScope === 'none') reviewScope = 'targeted';
            continue;
        }
        if (policy === FULL_REVIEW) {
            pendingFields.push(field);
            reviewReasons.push({ field, code: 'SERVICE_CLASSIFICATION_CHANGED' });
            reviewScope = 'full';
        }
    }

    return {
        beforeSnapshot: revisionType === 'creation' ? {} : publicSnapshot,
        proposedSnapshot,
        changedFields,
        autoAppliedFields,
        pendingFields,
        reviewReasons,
        reviewScope,
        changes: Object.fromEntries(changedFields.map((field) => [field, proposedSnapshot[field]])),
        autoAppliedChanges: Object.fromEntries(autoAppliedFields.map((field) => [field, proposedSnapshot[field]])),
        pendingChanges: Object.fromEntries(pendingFields.map((field) => [field, proposedSnapshot[field]])),
        hasPricingChange: autoAppliedFields.some((field) => SERVICE_PRICING_FIELD_SET.has(field)),
    };
};

export default {
    SERVICE_CHANGE_FIELDS,
    SERVICE_FIELD_POLICY,
    SERVICE_PRICING_FIELDS,
    assertKnownServiceChangeFields,
    classifyServiceChanges,
    evaluateTextChange,
    snapshotServiceFields,
};
