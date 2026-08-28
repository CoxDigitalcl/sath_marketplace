import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileSearch,
    Loader2,
    MessageSquare,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    X,
    XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../api/client';
import VideoPlayer from '../../common/VideoPlayer';

export type ServiceRevisionDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export interface ServiceRevisionSummary {
    id: string;
    serviceId: string;
    serviceName?: string;
    providerName?: string;
    scope: 'targeted' | 'full';
    changedFields: string[];
    reasons: string[];
    createdAt?: string;
    status: string;
}

interface ServiceRevisionChange {
    field: string;
    label?: string;
    before: unknown;
    after: unknown;
    reasons: string[];
}

interface ServiceRevisionDetail extends ServiceRevisionSummary {
    changes: ServiceRevisionChange[];
    publishedSnapshot: Record<string, unknown>;
    proposedSnapshot: Record<string, unknown>;
}

interface ServiceFallback {
    id: string;
    name: string;
    providerName?: string;
}

interface ServiceRevisionReviewModalProps {
    open: boolean;
    revisionId: string | null;
    service?: ServiceFallback;
    onClose: () => void;
    onDecided: () => void | Promise<void>;
}

const FIELD_LABELS: Record<string, string> = {
    title: 'Nombre del Servicio',
    name: 'Nombre del Servicio',
    description: 'Descripción',
    price: 'Precio',
    price_clp: 'Precio',
    duration_minutes: 'Duración',
    type: 'Modalidad',
    availability_type: 'Disponibilidad',
    calendar_config: 'Agenda semanal',
    category: 'Categoría',
    categories: 'Categorías',
    categories_json: 'Categorías',
    subcategory: 'Subcategoría',
    features: 'Características',
    video_url: 'Video',
    videoUrl: 'Video',
    cover_image_url: 'Imagen de portada',
    coverImageUrl: 'Imagen de portada',
    image_urls: 'Imágenes',
    imageUrls: 'Imágenes',
    gallery_media: 'Galería',
    galleryMedia: 'Galería',
    coverage_area: 'Cobertura',
    coverage_region_name: 'Región de cobertura',
    coverage_communes: 'Comunas de cobertura',
    pricing_type: 'Forma de cobro',
    freight_base_price: 'Tarifa base',
    freight_price_per_km: 'Tarifa por kilómetro',
    freight_max_distance_km: 'Distancia máxima de traslado'
};

const REVIEW_REASON_LABELS: Record<string, string> = {
    NEW_SERVICE_REVIEW: 'Servicio nuevo',
    MEDIA_CHANGED: 'Recurso multimedia modificado',
    SERVICE_CLASSIFICATION_CHANGED: 'Clasificación del Servicio modificada',
    TEXT_EXTERNAL_LINK: 'Enlace externo detectado',
    TEXT_CONTACT_INFORMATION: 'Datos de contacto detectados',
    TEXT_OFF_PLATFORM_TRANSACTION: 'Posible transacción fuera de la plataforma',
    TEXT_SUBSTANTIAL_CHANGE: 'Cambio sustancial de contenido',
    LEGACY_PENDING_REVIEW: 'Servicio pendiente anterior al nuevo sistema'
};

const REASON_OPTIONS = [
    { value: 'INACCURATE_INFORMATION', label: 'Información inexacta o incompleta' },
    { value: 'POLICY_VIOLATION', label: 'Incumplimiento de las políticas' },
    { value: 'UNSAFE_CONTENT', label: 'Contenido o prestación potencialmente insegura' },
    { value: 'LOW_QUALITY_MEDIA', label: 'Recurso multimedia insuficiente o defectuoso' },
    { value: 'CONTACT_INFORMATION', label: 'Datos de contacto o derivación fuera de la plataforma' },
    { value: 'OTHER', label: 'Otro motivo' }
];

const FULL_REVIEW_CHECKLIST = [
    { id: 'information_verified', label: 'La información principal es coherente y verificable.' },
    { id: 'safe_and_legal', label: 'La prestación descrita es segura y no presenta indicios de ilegalidad.' },
    { id: 'respectful_and_policy_compliant', label: 'El contenido es respetuoso y cumple las políticas de la plataforma.' },
    { id: 'media_reviewed', label: 'Revisé los recursos multimedia y corresponden al Servicio.' },
] as const;

const firstDefined = (...values: unknown[]) => values.find(value => value !== undefined);

const asRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
);

const asStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map(item => {
        if (item && typeof item === 'object') {
            const record = asRecord(item);
            return String(firstDefined(record.code, record.reason, record.label, '') || '');
        }
        return String(item);
    }).filter(Boolean);
};

const labelForField = (field: string) => FIELD_LABELS[field]
    || field.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());

const labelForReviewReason = (reason: string) => REVIEW_REASON_LABELS[reason]
    || reason.replace(/_/g, ' ').toLocaleLowerCase('es-CL').replace(/^./, letter => letter.toUpperCase());

const normalizeChanges = (
    rawChanges: unknown,
    changedFields: string[],
    publishedSnapshot: Record<string, unknown>,
    proposedSnapshot: Record<string, unknown>
): ServiceRevisionChange[] => {
    if (Array.isArray(rawChanges)) {
        return rawChanges.map((item, index) => {
            const change = asRecord(item);
            const field = String(firstDefined(
                change.field,
                change.fieldName,
                change.field_name,
                change.name,
                changedFields[index],
                `change_${index + 1}`
            ));

            return {
                field,
                label: typeof change.label === 'string' ? change.label : undefined,
                before: firstDefined(change.before, change.oldValue, change.old_value, change.from, publishedSnapshot[field]),
                after: firstDefined(change.after, change.newValue, change.new_value, change.to, proposedSnapshot[field]),
                reasons: asStringArray(firstDefined(change.reasons, change.reasonCodes, change.reason_codes))
            };
        });
    }

    const changesRecord = asRecord(rawChanges);
    const fields = Object.keys(changesRecord).length > 0 ? Object.keys(changesRecord) : changedFields;
    return fields.map(field => {
        const rawChange = changesRecord[field];
        const change = asRecord(rawChange);
        return {
            field,
            label: typeof change.label === 'string' ? change.label : undefined,
            before: firstDefined(change.before, change.oldValue, change.old_value, change.from, publishedSnapshot[field]),
            after: firstDefined(
                change.after,
                change.newValue,
                change.new_value,
                change.to,
                Object.keys(change).length === 0 ? rawChange : undefined,
                proposedSnapshot[field]
            ),
            reasons: asStringArray(firstDefined(change.reasons, change.reasonCodes, change.reason_codes))
        };
    });
};

export const normalizeServiceRevisionSummary = (raw: unknown): ServiceRevisionSummary | null => {
    const revision = asRecord(raw);
    const id = firstDefined(revision.id, revision.revisionId, revision.revision_id);
    const serviceId = firstDefined(revision.serviceId, revision.service_id, asRecord(revision.service).id);
    if (!id || !serviceId) return null;

    const service = asRecord(revision.service);
    const provider = asRecord(firstDefined(revision.provider, service.provider));
    const changedFields = asStringArray(firstDefined(
        revision.pendingFields,
        revision.pending_fields,
        revision.changedFields,
        revision.changed_fields,
        revision.fields,
        Object.keys(asRecord(firstDefined(revision.changes, revision.diff)))
    ));

    const rawScope = String(firstDefined(revision.scope, revision.reviewScope, revision.review_scope, 'targeted')).toLowerCase();
    return {
        id: String(id),
        serviceId: String(serviceId),
        serviceName: String(firstDefined(revision.serviceName, revision.service_name, service.name, service.title, '') || '') || undefined,
        providerName: String(firstDefined(revision.providerName, revision.provider_name, provider.name, provider.full_name, '') || '') || undefined,
        scope: rawScope === 'full' || rawScope === 'complete' ? 'full' : 'targeted',
        changedFields,
        reasons: asStringArray(firstDefined(
            revision.reviewReasons,
            revision.review_reasons,
            revision.reasons,
            revision.reasonCodes,
            revision.reason_codes
        )),
        createdAt: String(firstDefined(revision.createdAt, revision.created_at, revision.submittedAt, revision.submitted_at, '') || '') || undefined,
        status: String(firstDefined(revision.status, 'pending')).toLowerCase()
    };
};

const normalizeRevisionDetail = (raw: unknown): ServiceRevisionDetail | null => {
    const payload = asRecord(raw);
    const revision = asRecord(firstDefined(payload.revision, asRecord(payload.data).revision, payload.data, raw));
    const summary = normalizeServiceRevisionSummary(revision);
    if (!summary) return null;

    const serviceSnapshot = asRecord(revision.service);
    const beforeValues = asRecord(firstDefined(revision.beforeValues, revision.before_values));
    const proposedValues = asRecord(firstDefined(revision.proposedValues, revision.proposed_values));
    const explicitPublishedSnapshot = asRecord(firstDefined(
        revision.publishedSnapshot,
        revision.published_snapshot,
        revision.beforeSnapshot,
        revision.before_snapshot,
        revision.currentService,
        revision.current_service
    ));
    const publishedSnapshot = {
        ...serviceSnapshot,
        ...explicitPublishedSnapshot,
        ...beforeValues
    };
    const explicitProposedSnapshot = asRecord(firstDefined(
        revision.proposedSnapshot,
        revision.proposed_snapshot,
        revision.afterSnapshot,
        revision.after_snapshot,
        revision.proposedService,
        revision.proposed_service,
        revision.snapshot
    ));
    const proposedSnapshot = {
        ...publishedSnapshot,
        ...explicitProposedSnapshot,
        ...proposedValues
    };
    const rawChanges = firstDefined(revision.changes, revision.diff, revision.changeSet, revision.change_set);
    const rawReviewReasons = firstDefined(revision.reviewReasons, revision.review_reasons);
    const reviewReasons = Array.isArray(rawReviewReasons) ? rawReviewReasons.map(asRecord) : [];
    const changes = normalizeChanges(rawChanges, summary.changedFields, publishedSnapshot, proposedSnapshot).map(change => {
        if (change.reasons.length > 0) return change;
        return {
            ...change,
            reasons: reviewReasons
                .filter(reason => !reason.field || String(reason.field) === change.field)
                .map(reason => String(firstDefined(reason.code, reason.label, reason.reason, '') || ''))
                .filter(Boolean)
        };
    });

    return {
        ...summary,
        changedFields: summary.changedFields.length > 0 ? summary.changedFields : changes.map(change => change.field),
        changes,
        publishedSnapshot,
        proposedSnapshot
    };
};

const isLegacyPendingReview = (revision: ServiceRevisionDetail | null) => {
    if (!revision) return false;
    const reasons = [
        ...revision.reasons,
        ...revision.changes.flatMap(change => change.reasons)
    ];
    return reasons.some(reason => String(reason)
        .trim()
        .replace(/\s+/g, '_')
        .toLocaleUpperCase('es-CL') === 'LEGACY_PENDING_REVIEW');
};

const getApiMessage = (error: unknown, fallback: string) => {
    const response = asRecord(asRecord(error).response);
    const data = asRecord(response.data);
    return typeof data.message === 'string' && data.message.trim() ? data.message : fallback;
};

const isMediaField = (field: string) => /(image|gallery|video|media)/i.test(field);
const isVideoField = (field: string) => /video/i.test(field);
const isPriceField = (field: string) => /(price|precio|tarifa)/i.test(field);
const isDurationField = (field: string) => /(duration|duraci)/i.test(field);
const isCalendarField = (field: string) => field === 'calendar_config';

const CODED_VALUE_LABELS: Record<string, Record<string, string>> = {
    pricing_type: {
        per_event: 'Por servicio o evento',
        per_hour: 'Por hora',
        fixed: 'Precio fijo'
    },
    type: {
        online: 'En línea',
        presencial: 'Presencial',
        hibrido: 'Híbrido',
        hybrid: 'Híbrido'
    },
    availability_type: {
        agenda: 'Con agenda',
        inmediato: 'Disponibilidad inmediata',
        immediate: 'Disponibilidad inmediata',
        '24h': 'Dentro de 24 horas',
        quote: 'Sujeto a cotización'
    }
};

const DAY_LABELS: Record<string, string> = {
    lunes: 'Lunes',
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    sabado: 'Sábado',
    domingo: 'Domingo'
};

const normalizeDayKey = (value: unknown) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CL');

const asStructuredValue = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

interface AdminScheduleRow {
    day: string;
    active: boolean;
    ranges: Array<{ start: string; end: string }>;
}

const normalizeSchedule = (value: unknown): AdminScheduleRow[] | null => {
    const config = asRecord(asStructuredValue(value));
    if (!Array.isArray(config.schedule)) return null;

    return config.schedule.map((item, index) => {
        const row = asRecord(item);
        const dayKey = normalizeDayKey(row.day);
        const ranges = Array.isArray(row.timeRanges)
            ? row.timeRanges.map(range => {
                const values = asRecord(range);
                return { start: String(values.start || ''), end: String(values.end || '') };
            }).filter(range => range.start && range.end)
            : [];
        return {
            day: DAY_LABELS[dayKey] || String(row.day || `Día ${index + 1}`),
            active: row.active === true || (row.active !== false && ranges.length > 0),
            ranges
        };
    });
};

const formatValue = (value: unknown, field: string) => {
    if (value === null || value === undefined || value === '') return 'Sin información';
    const codedLabel = CODED_VALUE_LABELS[field]?.[String(value).toLocaleLowerCase('es-CL')];
    if (codedLabel) return codedLabel;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number' && isPriceField(field)) {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
    }
    if ((typeof value === 'number' || /^\d+$/.test(String(value))) && isDurationField(field)) {
        return `${Number(value).toLocaleString('es-CL')} minutos`;
    }
    if (Array.isArray(value)) {
        return value.length > 0
            ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ')
            : 'Sin información';
    }
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
};

const WeeklyScheduleValue: React.FC<{ value: unknown }> = ({ value }) => {
    const schedule = normalizeSchedule(value);
    if (!schedule) {
        return <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-900">{formatValue(value, 'calendar_config')}</p>;
    }
    if (schedule.length === 0) return <p className="text-sm italic text-gray-500">Sin días configurados</p>;

    return (
        <dl className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {schedule.map((row, index) => (
                <div key={`${row.day}-${index}`} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-gray-800">{row.day}</dt>
                    <dd className="flex flex-wrap gap-1.5 text-sm sm:justify-end">
                        {!row.active ? (
                            <span className="text-gray-500">No disponible</span>
                        ) : row.ranges.length === 0 ? (
                            <span className="text-amber-700">Horario no informado</span>
                        ) : row.ranges.map((range, rangeIndex) => (
                            <span key={`${range.start}-${range.end}-${rangeIndex}`} className="rounded-full bg-sky-50 px-2.5 py-1 font-medium tabular-nums text-sky-800">
                                {range.start}–{range.end}
                            </span>
                        ))}
                    </dd>
                </div>
            ))}
        </dl>
    );
};

const isSafeAdminMediaUrl = (value: string, video: boolean) => {
    if (/^\/uploads\/[A-Za-z0-9/_\-.%]+$/u.test(value) && !value.includes('..')) return true;
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
        if (!video) return true;
        const host = parsed.hostname.toLowerCase();
        return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') ||
            host === 'vimeo.com' || host.endsWith('.vimeo.com');
    } catch {
        return false;
    }
};

const collectMediaUrls = (value: unknown, field: string): Array<{ url: string; type?: string }> => {
    const result: Array<{ url: string; type?: string }> = [];
    if (typeof value === 'string' && value.trim()) result.push({ url: value });
    if (Array.isArray(value)) {
        result.push(...value.flatMap(item => {
            if (typeof item === 'string' && item.trim()) return [{ url: item }];
            const media = asRecord(item);
            return typeof media.url === 'string' && media.url.trim()
                ? [{ url: media.url, type: typeof media.type === 'string' ? media.type : undefined }]
                : [];
        }));
    }
    return result.filter(item => isSafeAdminMediaUrl(item.url, isVideoField(field) || item.type === 'video'));
};

const MissingMediaNotice: React.FC<{ kind: 'imagen' | 'video' }> = ({ kind }) => (
    <div className="flex aspect-video w-full items-center justify-center bg-gray-100 px-5 text-center text-gray-600" role="status">
        <div className="max-w-sm">
            <AlertCircle size={32} className="mx-auto mb-2 text-red-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-800">Archivo de {kind} no disponible</p>
            <p className="mt-1 text-xs leading-5 text-gray-600">El archivo referenciado no existe o ya no está accesible. Solicita al proveedor que lo reemplace antes de aprobar.</p>
        </div>
    </div>
);

const AdminImagePreview: React.FC<{ url: string; alt: string }> = ({ url, alt }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [url]);

    if (failed) return <MissingMediaNotice kind="imagen" />;
    return (
        <img
            src={url}
            alt={alt}
            className="aspect-video w-full bg-gray-100 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
        />
    );
};

const MediaValue: React.FC<{ value: unknown; field: string; label: string }> = ({ value, field, label }) => {
    const media = collectMediaUrls(value, field);
    if (media.length === 0) return <p className="text-sm italic text-gray-500">Sin recurso</p>;

    return (
        <div className="grid gap-3">
            {media.map((item, index) => {
                const video = isVideoField(field) || item.type === 'video';
                return (
                    <div key={`${item.url}-${index}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        {video ? (
                            <VideoPlayer
                                url={item.url}
                                className="w-full"
                                title={`${label}${media.length > 1 ? ` ${index + 1}` : ''}`}
                                errorTitle="Archivo de video no disponible"
                                errorDescription="El archivo referenciado no existe o ya no está accesible. Solicita al proveedor que lo reemplace antes de aprobar."
                            />
                        ) : (
                            <AdminImagePreview url={item.url} alt={`${label}${media.length > 1 ? ` ${index + 1}` : ''}`} />
                        )}
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate px-3 py-2 text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
                        >
                            Abrir recurso en otra pestaña
                        </a>
                    </div>
                );
            })}
        </div>
    );
};

const ValuePanel: React.FC<{
    value: unknown;
    field: string;
    tone: 'before' | 'after' | 'neutral';
    title: string;
}> = ({ value, field, tone, title }) => {
    const styles = tone === 'before'
        ? 'border-red-200 bg-red-50/50'
        : tone === 'after'
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-gray-200 bg-gray-50';

    return (
        <section className={`min-w-0 rounded-xl border p-4 ${styles}`} aria-label={title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</p>
            {isCalendarField(field) ? (
                <WeeklyScheduleValue value={value} />
            ) : isMediaField(field) ? (
                <MediaValue value={value} field={field} label={`${title}: ${labelForField(field)}`} />
            ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-900">{formatValue(value, field)}</p>
            )}
        </section>
    );
};

const FullServiceReview: React.FC<{ snapshot: Record<string, unknown>; panelTitle?: string }> = ({
    snapshot,
    panelTitle = 'Versión propuesta'
}) => {
    const preferredFields = [
        'title', 'name', 'description', 'category', 'categories', 'categories_json', 'subcategory',
        'price', 'price_clp', 'duration_minutes', 'pricing_type', 'type', 'availability_type', 'calendar_config',
        'coverage_area', 'coverage_region_name', 'coverage_communes', 'features', 'video_url', 'videoUrl',
        'cover_image_url', 'coverImageUrl', 'image_urls', 'imageUrls', 'gallery_media', 'galleryMedia',
        'freight_base_price', 'freight_price_per_km', 'freight_max_distance_km'
    ];
    const fields = preferredFields.filter(field => Object.prototype.hasOwnProperty.call(snapshot, field));

    if (fields.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
                La API no entregó una ficha completa para esta revisión. Los cambios individuales siguen disponibles arriba.
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(field => (
                <div key={field} className={field === 'description' || isMediaField(field) || isCalendarField(field) ? 'sm:col-span-2' : ''}>
                    <p className="mb-1.5 text-sm font-semibold text-gray-800">{labelForField(field)}</p>
                    <ValuePanel value={snapshot[field]} field={field} tone="neutral" title={panelTitle} />
                </div>
            ))}
        </div>
    );
};

const ServiceRevisionReviewModal: React.FC<ServiceRevisionReviewModalProps> = ({
    open,
    revisionId,
    service,
    onClose,
    onDecided
}) => {
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const decisionSectionRef = useRef<HTMLElement>(null);
    const [detail, setDetail] = useState<ServiceRevisionDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [showFullReview, setShowFullReview] = useState(false);
    const [decisionIntent, setDecisionIntent] = useState<ServiceRevisionDecision | null>(null);
    const [reasonCode, setReasonCode] = useState('');
    const [note, setNote] = useState('');
    const [decisionError, setDecisionError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [checklistItems, setChecklistItems] = useState<string[]>([]);

    const fetchDetail = async () => {
        if (!revisionId) return;
        setLoading(true);
        setLoadError('');
        try {
            const response = await api.get(`/admin/service-revisions/${revisionId}`);
            const normalized = normalizeRevisionDetail(response.data);
            if (!normalized) throw new Error('INVALID_REVISION_PAYLOAD');
            setDetail(normalized);
            setShowFullReview(isLegacyPendingReview(normalized));
        } catch (error) {
            setDetail(null);
            setLoadError(getApiMessage(error, 'No se pudo cargar el detalle de esta revisión.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open || !revisionId) return;
        setDetail(null);
        setShowFullReview(false);
        setDecisionIntent(null);
        setReasonCode('');
        setNote('');
        setDecisionError('');
        setChecklistItems([]);
        void fetchDetail();
    }, [open, revisionId]);

    useEffect(() => {
        if (!decisionIntent) return;
        decisionSectionRef.current?.focus();
    }, [decisionIntent]);

    const serviceName = detail?.serviceName || service?.name || 'Servicio';
    const providerName = detail?.providerName || service?.providerName;
    const legacyReview = isLegacyPendingReview(detail);
    const reasonRequired = decisionIntent === 'REQUEST_CHANGES' || decisionIntent === 'REJECT';
    const fullApprovalChecklistComplete = detail?.scope !== 'full'
        || FULL_REVIEW_CHECKLIST.every(item => checklistItems.includes(item.id));
    const canSubmit = decisionIntent === 'APPROVE'
        ? fullApprovalChecklistComplete
        : Boolean(reasonRequired && reasonCode.length > 0 && note.trim().length > 0);

    const decisionCopy = useMemo(() => {
        if (decisionIntent === 'APPROVE') {
            return {
                title: 'Confirmar aprobación',
                description: 'Se publicará exactamente la revisión que acabas de examinar.',
                submit: 'Confirmar aprobación',
                tone: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600'
            };
        }
        if (decisionIntent === 'REQUEST_CHANGES') {
            return {
                title: 'Solicitar una corrección',
                description: 'La versión pública actual no cambiará. El proveedor recibirá tu indicación.',
                submit: 'Enviar solicitud',
                tone: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600'
            };
        }
        return {
            title: 'Confirmar rechazo',
            description: 'La propuesta quedará rechazada y la versión pública actual no cambiará.',
            submit: 'Confirmar rechazo',
            tone: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600'
        };
    }, [decisionIntent]);

    const submitDecision = async () => {
        if (!revisionId || !decisionIntent || !canSubmit) return;
        setSubmitting(true);
        setDecisionError('');
        try {
            const decision = decisionIntent === 'APPROVE'
                ? 'approved'
                : decisionIntent === 'REQUEST_CHANGES'
                    ? 'correction_requested'
                    : 'rejected';
            const body: {
                decision: 'approved' | 'correction_requested' | 'rejected';
                expectedRevisionId: string;
                reasonCode?: string;
                comment?: string;
                reviewedFields?: string[];
                checklistItems?: string[];
            } = {
                decision,
                expectedRevisionId: revisionId,
                reviewedFields: detail?.changedFields || []
            };
            if (reasonRequired) {
                body.reasonCode = reasonCode;
                body.comment = note.trim();
            }
            if (decision === 'approved' && detail?.scope === 'full') {
                body.checklistItems = checklistItems;
            }
            const response = await api.post(`/admin/service-revisions/${revisionId}/decisions`, body);
            toast.success(response.data?.message || (
                decisionIntent === 'APPROVE'
                    ? 'Cambios aprobados.'
                    : decisionIntent === 'REQUEST_CHANGES'
                        ? 'Corrección solicitada al proveedor.'
                        : 'Cambios rechazados.'
            ));
            await onDecided();
        } catch (error) {
            const response = asRecord(asRecord(error).response);
            const data = asRecord(response.data);
            const stale = Number(response.status) === 409
                || data.code === 'REVISION_STALE'
                || data.code === 'SERVICE_REVISION_STALE';
            setDecisionError(stale
                ? 'Esta revisión fue reemplazada por cambios más recientes. Cierra este modal y abre la revisión vigente.'
                : getApiMessage(error, 'No se pudo registrar la decisión. Inténtalo nuevamente.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Transition show={open} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-[80]"
                initialFocus={closeButtonRef}
                onClose={submitting ? () => undefined : onClose}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-0 text-left sm:items-center sm:p-6">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
                            enterTo="translate-y-0 opacity-100 sm:scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="translate-y-0 opacity-100 sm:scale-100"
                            leaveTo="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl">
                                <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
                                    <div className="min-w-0">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                                                <ShieldAlert size={14} aria-hidden="true" />
                                                Requiere revisión
                                            </span>
                                            {detail?.scope === 'full' && (
                                                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800">
                                                    Revisión completa
                                                </span>
                                            )}
                                            {legacyReview && (
                                                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                                    Revisión de compatibilidad
                                                </span>
                                            )}
                                        </div>
                                        <Dialog.Title className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
                                            {serviceName}
                                        </Dialog.Title>
                                        {providerName && <p className="mt-1 text-sm text-gray-600">Proveedor: {providerName}</p>}
                                    </div>
                                    <button
                                        ref={closeButtonRef}
                                        type="button"
                                        onClick={onClose}
                                        disabled={submitting}
                                        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="Cerrar revisión"
                                    >
                                        <X size={22} aria-hidden="true" />
                                    </button>
                                </header>

                                <div className="overflow-y-auto px-5 py-5 sm:px-6">
                                    {loading && (
                                        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-600" role="status">
                                            <Loader2 className="animate-spin text-brand-primary" size={32} aria-hidden="true" />
                                            <span>Cargando diferencias…</span>
                                        </div>
                                    )}

                                    {!loading && loadError && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="mt-0.5 flex-none text-red-600" size={22} aria-hidden="true" />
                                                <div>
                                                    <p className="font-semibold text-red-900">No pudimos abrir esta revisión</p>
                                                    <p className="mt-1 text-sm text-red-800">{loadError}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => void fetchDetail()}
                                                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                                                    >
                                                        <RefreshCw size={16} aria-hidden="true" />
                                                        Reintentar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!loading && detail && (
                                        <div className="space-y-6">
                                            {legacyReview ? (
                                                <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5" aria-labelledby="legacy-review-heading">
                                                    <div className="flex items-start gap-3">
                                                        <ShieldAlert className="mt-0.5 flex-none text-sky-700" size={22} aria-hidden="true" />
                                                        <div>
                                                            <h3 id="legacy-review-heading" className="font-bold text-sky-950">Revisión inicial de un Servicio existente</h3>
                                                            <p className="mt-1 text-sm leading-6 text-sky-900">
                                                                Este Servicio ya estaba pendiente cuando se habilitó el nuevo sistema de moderación. No existe un historial confiable para comparar, por lo que no se muestran diferencias artificiales: debes revisar la ficha completa actual.
                                                            </p>
                                                            <p className="mt-2 text-sm leading-6 text-sky-900">
                                                                Este formato solo corresponde a registros heredados. Aprobar valida su contenido, pero no activa automáticamente el Servicio; el proveedor podrá activarlo después.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </section>
                                            ) : (
                                                <section aria-labelledby="revision-changes-heading">
                                                    <div className="mb-4">
                                                        <h3 id="revision-changes-heading" className="text-lg font-bold text-gray-900">
                                                            Qué cambió
                                                        </h3>
                                                        <p className="mt-1 text-sm text-gray-600">
                                                            Compara la versión publicada con la propuesta antes de decidir.
                                                        </p>
                                                    </div>

                                                    {detail.changes.length === 0 ? (
                                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                                                            La revisión está pendiente, pero la API no informó diferencias. No apruebes hasta contar con el detalle verificable.
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-5">
                                                            {detail.changes.map(change => (
                                                                <article key={change.field} className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                                                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                                                        <h4 className="font-bold text-gray-900">{change.label || labelForField(change.field)}</h4>
                                                                        {change.reasons.map(reason => (
                                                                            <span key={reason} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                                                                                {labelForReviewReason(reason)}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    <div className="grid gap-3 md:grid-cols-2">
                                                                        <ValuePanel value={change.before} field={change.field} tone="before" title="Versión publicada" />
                                                                        <ValuePanel value={change.after} field={change.field} tone="after" title="Cambio propuesto" />
                                                                    </div>
                                                                </article>
                                                            ))}
                                                        </div>
                                                    )}
                                                </section>
                                            )}

                                            <section className="border-t border-gray-200 pt-5" aria-labelledby="full-review-heading">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowFullReview(current => !current)}
                                                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                                                    aria-expanded={showFullReview}
                                                    aria-controls="full-service-review"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <FileSearch size={20} className="text-brand-primary" aria-hidden="true" />
                                                        {showFullReview ? 'Ocultar ficha completa' : 'Revisar Servicio completo'}
                                                    </span>
                                                    {showFullReview
                                                        ? <ChevronUp size={20} aria-hidden="true" />
                                                        : <ChevronDown size={20} aria-hidden="true" />}
                                                </button>
                                                {showFullReview && (
                                                    <div id="full-service-review" className="mt-4">
                                                        <h3 id="full-review-heading" className="mb-1 text-lg font-bold text-gray-900">
                                                            {legacyReview ? 'Ficha completa actual' : 'Ficha completa propuesta'}
                                                        </h3>
                                                        <p className="mb-4 text-sm text-gray-600">
                                                            {legacyReview
                                                                ? 'Esta es la ficha actual que debes comprobar antes de tomar una decisión.'
                                                                : 'Esta vista amplía el contexto; no aprueba el Servicio automáticamente.'}
                                                        </p>
                                                        <FullServiceReview
                                                            snapshot={detail.proposedSnapshot}
                                                            panelTitle={legacyReview ? 'Contenido actual' : 'Versión propuesta'}
                                                        />
                                                    </div>
                                                )}
                                            </section>

                                            {decisionIntent && (
                                                <section
                                                    ref={decisionSectionRef}
                                                    tabIndex={-1}
                                                    className="rounded-2xl border border-gray-300 bg-gray-50 p-4 outline-none sm:p-5"
                                                    aria-labelledby="decision-confirmation-heading"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 id="decision-confirmation-heading" className="font-bold text-gray-900">{decisionCopy.title}</h3>
                                                            <p className="mt-1 text-sm text-gray-600">{decisionCopy.description}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setDecisionIntent(null);
                                                                setDecisionError('');
                                                            }}
                                                            disabled={submitting}
                                                            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full text-gray-500 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                                                            aria-label="Cancelar decisión"
                                                        >
                                                            <RotateCcw size={18} aria-hidden="true" />
                                                        </button>
                                                    </div>

                                                    {reasonRequired && (
                                                        <div className="mt-4 grid gap-4">
                                                            <div>
                                                                <label htmlFor="revision-reason-code" className="block text-sm font-semibold text-gray-800">
                                                                    Motivo <span aria-hidden="true" className="text-red-600">*</span>
                                                                </label>
                                                                <select
                                                                    id="revision-reason-code"
                                                                    value={reasonCode}
                                                                    onChange={event => setReasonCode(event.target.value)}
                                                                    disabled={submitting}
                                                                    required
                                                                    className="mt-1.5 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100"
                                                                >
                                                                    <option value="">Selecciona un motivo</option>
                                                                    {REASON_OPTIONS.map(option => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label htmlFor="revision-decision-note" className="block text-sm font-semibold text-gray-800">
                                                                    Explicación para el proveedor <span aria-hidden="true" className="text-red-600">*</span>
                                                                </label>
                                                                <textarea
                                                                    id="revision-decision-note"
                                                                    value={note}
                                                                    onChange={event => setNote(event.target.value.slice(0, 1000))}
                                                                    disabled={submitting}
                                                                    required
                                                                    rows={4}
                                                                    maxLength={1000}
                                                                    aria-describedby="revision-note-help"
                                                                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100"
                                                                />
                                                                <div id="revision-note-help" className="mt-1 flex justify-between gap-3 text-xs text-gray-500">
                                                                    <span>Indica qué debe corregir o por qué no puede aceptarse.</span>
                                                                    <span>{note.length}/1000</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {decisionIntent === 'APPROVE' && detail.scope === 'full' && (
                                                        <fieldset className="mt-4 rounded-xl border border-purple-200 bg-purple-50/60 p-4">
                                                            <legend className="px-1 text-sm font-bold text-gray-900">Lista de comprobación obligatoria</legend>
                                                            <p className="mb-3 text-sm text-gray-600">Confirma cada punto después de revisar la ficha completa propuesta.</p>
                                                            <div className="space-y-3">
                                                                {FULL_REVIEW_CHECKLIST.map(item => (
                                                                    <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-purple-100 bg-white p-3 text-sm text-gray-800">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checklistItems.includes(item.id)}
                                                                            onChange={event => setChecklistItems(current => event.target.checked
                                                                                ? [...current, item.id]
                                                                                : current.filter(value => value !== item.id))}
                                                                            disabled={submitting}
                                                                            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                                        />
                                                                        <span>{item.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </fieldset>
                                                    )}

                                                    {decisionError && (
                                                        <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-100 p-3 text-sm text-red-900" role="alert">
                                                            <AlertCircle className="mt-0.5 flex-none" size={17} aria-hidden="true" />
                                                            {decisionError}
                                                        </p>
                                                    )}

                                                    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDecisionIntent(null)}
                                                            disabled={submitting}
                                                            className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void submitDecision()}
                                                            disabled={!canSubmit || submitting}
                                                            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${decisionCopy.tone}`}
                                                        >
                                                            {submitting && <Loader2 className="animate-spin" size={17} aria-hidden="true" />}
                                                            {submitting ? 'Registrando decisión…' : decisionCopy.submit}
                                                        </button>
                                                    </div>
                                                </section>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {!loading && detail && (
                                    <footer className="border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
                                        <p className="mb-3 text-xs text-gray-600">
                                            La decisión se aplicará a esta revisión exacta. Si el proveedor realizó otro cambio, el servidor impedirá aprobar una versión obsoleta.
                                        </p>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <button
                                                type="button"
                                                 onClick={() => {
                                                     setDecisionIntent('APPROVE');
                                                     if (detail.scope === 'full') setShowFullReview(true);
                                                     setDecisionError('');
                                                 }}
                                                disabled={submitting || detail.changes.length === 0}
                                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={18} aria-hidden="true" />
                                                Aprobar cambios
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDecisionIntent('REQUEST_CHANGES');
                                                    setDecisionError('');
                                                }}
                                                disabled={submitting || detail.changes.length === 0}
                                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <MessageSquare size={18} aria-hidden="true" />
                                                Solicitar corrección
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDecisionIntent('REJECT');
                                                    setDecisionError('');
                                                }}
                                                disabled={submitting || detail.changes.length === 0}
                                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <XCircle size={18} aria-hidden="true" />
                                                Rechazar cambios
                                            </button>
                                        </div>
                                    </footer>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default ServiceRevisionReviewModal;
