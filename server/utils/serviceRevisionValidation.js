import { z } from 'zod';

const MAX_POSTGRES_INTEGER = 2147483647;
const boundedJsonObject = (label, maxBytes = 100_000) => z.record(z.unknown())
    .refine((value) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes, {
        message: `${label} excede el tamaño permitido`,
    });

const isSafeLocalMediaPath = (value) =>
    /^\/uploads\/[A-Za-z0-9/_\-.%]+$/u.test(value) && !value.includes('..');
const parseSafeHttpsUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed : null;
    } catch {
        return null;
    }
};
const isSafeMediaUrl = (value) => !value || isSafeLocalMediaPath(value) || Boolean(parseSafeHttpsUrl(value));
const isSafeVideoUrl = (value) => {
    if (!value || isSafeLocalMediaPath(value)) return true;
    const parsed = parseSafeHttpsUrl(value);
    if (!parsed) return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') ||
        host === 'vimeo.com' || host.endsWith('.vimeo.com');
};
const optionalMediaUrl = z.string().trim().max(512, 'La URL no puede superar 512 caracteres')
    .refine(isSafeMediaUrl, 'Usa una ruta de carga local o una URL HTTPS válida');
const optionalVideoUrl = z.string().trim().max(512, 'La URL no puede superar 512 caracteres')
    .refine(isSafeVideoUrl, 'Usa un video subido, YouTube o Vimeo mediante HTTPS');
const money = z.number()
    .int('El valor debe ser un número entero')
    .min(0, 'El valor no puede ser negativo')
    .max(MAX_POSTGRES_INTEGER, 'El valor excede el máximo permitido');

const categoryItemSchema = z.object({
    categoryId: z.string().trim().min(1).max(100),
    subcategory: z.string().trim().min(1).max(160),
}).strict();

const galleryMediaItemSchema = z.object({
    type: z.enum(['image', 'video']),
    url: optionalMediaUrl.refine(Boolean, 'La URL del medio es obligatoria'),
    thumbnail: optionalMediaUrl.optional(),
}).strict();
const fullReviewChecklistItemSchema = z.enum([
    'information_verified',
    'safe_and_legal',
    'respectful_and_policy_compliant',
    'media_reviewed',
]);

const serviceContentShape = {
    title: z.string().trim().min(1, 'El nombre del servicio es obligatorio').max(255),
    description: z.string().trim().max(20_000, 'La descripción es demasiado extensa'),
    category: z.string().trim().min(1, 'La categoría es obligatoria').max(100),
    price: money,
    video_url: optionalVideoUrl,
    duration_minutes: z.number().int().min(1).max(10_080),
    type: z.enum(['presencial', 'online', 'hibrido']),
    availability_type: z.enum(['agenda', 'inmediato', '24h']),
    calendar_config: boundedJsonObject('La configuración de agenda'),
    features: z.array(z.string().trim().min(1).max(240)).max(100),
    image_urls: z.array(optionalMediaUrl.refine(Boolean)).max(30),
    categories_json: z.array(categoryItemSchema).max(20),
    cover_image_url: optionalMediaUrl,
    gallery_media: z.array(galleryMediaItemSchema).max(30),
    pricing_type: z.enum(['per_event', 'per_hour']),
    freight_base_price: money.nullable(),
    freight_price_per_km: money.nullable(),
};

export const createServiceRevisionSchema = z.object({
    ...serviceContentShape,
    title: serviceContentShape.title,
    category: serviceContentShape.category,
    price: serviceContentShape.price,
    description: serviceContentShape.description.default(''),
    video_url: serviceContentShape.video_url.default(''),
    cover_image_url: serviceContentShape.cover_image_url.default(''),
    duration_minutes: serviceContentShape.duration_minutes.default(60),
    type: serviceContentShape.type.default('online'),
    availability_type: serviceContentShape.availability_type.default('agenda'),
    calendar_config: serviceContentShape.calendar_config.default({}),
    features: serviceContentShape.features.default([]),
    image_urls: serviceContentShape.image_urls.default([]),
    categories_json: serviceContentShape.categories_json.default([]),
    gallery_media: serviceContentShape.gallery_media.default([]),
    pricing_type: serviceContentShape.pricing_type.default('per_event'),
    freight_base_price: serviceContentShape.freight_base_price.default(null),
    freight_price_per_km: serviceContentShape.freight_price_per_km.default(null),
}).strict();

export const updateServiceRevisionSchema = z.object(
    Object.fromEntries(Object.entries(serviceContentShape).map(([key, schema]) => [key, schema.optional()]))
).extend({
    expected_revision_id: z.string().uuid().nullable(),
}).strict().refine(
    (value) => Object.keys(value).some((key) => key !== 'expected_revision_id'),
    { message: 'Debes enviar al menos un campo editable del servicio' }
);

export const serviceRevisionDecisionSchema = z.object({
    decision: z.enum(['approved', 'correction_requested', 'rejected']),
    expectedRevisionId: z.string().uuid(),
    reasonCode: z.string().trim().min(1).max(80).optional(),
    comment: z.string().trim().max(2_000).optional(),
    reviewedFields: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    checklistItems: z.array(fullReviewChecklistItemSchema).max(4).optional(),
}).strict().superRefine((value, context) => {
    if (value.expectedRevisionId === undefined) return;
    if (value.decision !== 'approved' && (!value.reasonCode || !value.comment)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['comment'],
            message: 'El motivo y la explicación son obligatorios para solicitar correcciones o rechazar',
        });
    }
});

export const serviceRevisionListQuerySchema = z.object({
    status: z.enum(['pending', 'correction_requested']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
    search: z.string().trim().max(120).default(''),
}).strict();

export const formatServiceValidationError = (error) => ({
    status: 'error',
    code: 'SERVICE_VALIDATION_FAILED',
    message: 'Revisa los datos del servicio e intenta nuevamente.',
    errors: error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
    })),
});
