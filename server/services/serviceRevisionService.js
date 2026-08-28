import { statSync } from 'node:fs';
import path from 'node:path';
import { pool as defaultPool } from '../config/db.js';
import { uploadDir } from '../config/uploadPaths.js';
import {
    SERVICE_CHANGE_FIELDS,
    SERVICE_PRICING_FIELDS,
    assertKnownServiceChangeFields,
    classifyServiceChanges,
    snapshotServiceFields,
} from './serviceChangePolicy.js';

const ACTIVE_REVISION_STATUSES = new Set(['pending', 'correction_requested']);
const DECISIONS = new Set(['approved', 'correction_requested', 'rejected']);
export const FULL_REVIEW_CHECKLIST_ITEMS = Object.freeze([
    'information_verified',
    'safe_and_legal',
    'respectful_and_policy_compliant',
    'media_reviewed',
]);
const FULL_REVIEW_CHECKLIST_ITEM_SET = new Set(FULL_REVIEW_CHECKLIST_ITEMS);
const SERVICE_CHANGE_FIELD_SET = new Set(SERVICE_CHANGE_FIELDS);
const SERVICE_PRICING_FIELD_SET = new Set(SERVICE_PRICING_FIELDS);
const SERVICE_MEDIA_FIELDS = new Set(['video_url', 'cover_image_url', 'image_urls', 'gallery_media']);
const JSON_SERVICE_FIELDS = new Set([
    'calendar_config',
    'features',
    'image_urls',
    'categories_json',
    'gallery_media',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LOCAL_UPLOAD_PATTERN = /^\/uploads\/[A-Za-z0-9/_\-.%]+$/u;

const parseJson = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const asArray = (value) => {
    const parsed = parseJson(value, []);
    return Array.isArray(parsed) ? parsed : [];
};

const asObject = (value) => {
    const parsed = parseJson(value, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

const collectReviewedLocalMedia = (snapshot, fields) => {
    const references = [];
    const add = (field, value) => {
        if (typeof value === 'string' && LOCAL_UPLOAD_PATTERN.test(value) && !value.includes('..')) {
            references.push({ field, url: value });
        }
    };

    for (const field of fields) {
        if (!SERVICE_MEDIA_FIELDS.has(field)) continue;
        const value = snapshot[field];
        if (field === 'video_url' || field === 'cover_image_url') {
            add(field, value);
        } else if (field === 'image_urls') {
            asArray(value).forEach(item => add(field, item));
        } else if (field === 'gallery_media') {
            asArray(value).forEach(item => {
                const media = asObject(item);
                add(field, media.url);
                add(field, media.thumbnail);
            });
        }
    }
    return references;
};

const defaultMediaExists = (url) => {
    try {
        const relativePath = decodeURIComponent(url.slice('/uploads/'.length));
        const root = path.resolve(uploadDir);
        const target = path.resolve(root, relativePath);
        const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
        return target.startsWith(rootPrefix) && statSync(target).isFile();
    } catch {
        return false;
    }
};

const normalizeIdentifier = (value, fieldName) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!UUID_PATTERN.test(normalized)) {
        throw new ServiceRevisionError(
            'INVALID_SERVICE_REVISION_IDENTIFIER',
            `${fieldName} no es un identificador válido.`,
            400
        );
    }
    return normalized;
};

const normalizeOptionalText = (value, maxLength) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const sameFieldSet = (left, right) => {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((field) => rightSet.has(field));
};

const outcomeFor = (classification) => {
    if (classification.pendingFields.length > 0 && classification.autoAppliedFields.length > 0) return 'mixed';
    if (classification.pendingFields.length > 0) return 'review_required';
    if (classification.changedFields.length === 0) return 'no_changes';
    return 'applied';
};

const revisionFromRow = (row) => row ? {
    id: row.id,
    serviceId: row.service_id,
    providerId: row.provider_id,
    revisionNumber: Number(row.revision_number),
    revisionType: row.revision_type,
    status: row.status,
    reviewScope: row.review_scope,
    beforeSnapshot: asObject(row.before_snapshot),
    proposedSnapshot: asObject(row.proposed_snapshot),
    changedFields: asArray(row.changed_fields),
    autoAppliedFields: asArray(row.auto_applied_fields),
    pendingFields: asArray(row.pending_fields),
    reviewReasons: asArray(row.review_reasons),
    baseServiceUpdatedAt: row.base_service_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at,
    decidedAt: row.decided_at,
    supersededAt: row.superseded_at,
} : null;

const serviceMetadataFromRow = (row) => ({
    id: row.id,
    providerId: row.provider_id,
    title: row.title,
    isActive: Boolean(row.is_active),
    moderationStatus: row.moderation_status,
    pricingVersion: Number(row.pricing_version || 1),
    updatedAt: row.updated_at,
});

const assignSql = ({ fields, values, proposedSnapshot, startIndex = 1 }) => fields.map((field, offset) => {
    const jsonField = JSON_SERVICE_FIELDS.has(field);
    values.push(jsonField ? JSON.stringify(proposedSnapshot[field]) : proposedSnapshot[field]);
    return `${field} = $${startIndex + offset}${jsonField ? '::jsonb' : ''}`;
});

export class ServiceRevisionError extends Error {
    constructor(code, message, statusCode = 400, details = undefined) {
        super(message);
        this.name = 'ServiceRevisionError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

export const createServiceRevisionService = ({ pool = defaultPool, mediaExists = defaultMediaExists } = {}) => {
    if (!pool || typeof pool.query !== 'function') {
        throw new TypeError('createServiceRevisionService requires a PostgreSQL pool.');
    }
    if (typeof mediaExists !== 'function') {
        throw new TypeError('createServiceRevisionService requires a media existence checker.');
    }

    const withTransaction = async (work) => {
        const client = typeof pool.connect === 'function' ? await pool.connect() : pool;
        let transactionOpen = false;
        try {
            await client.query('BEGIN');
            transactionOpen = true;
            const result = await work(client);
            await client.query('COMMIT');
            transactionOpen = false;
            return result;
        } catch (error) {
            if (transactionOpen) await client.query('ROLLBACK');
            throw error;
        } finally {
            if (client !== pool && typeof client.release === 'function') client.release();
        }
    };

    const getCurrentRevision = async ({ serviceId, providerId } = {}) => {
        const normalizedServiceId = normalizeIdentifier(serviceId, 'serviceId');
        const values = [normalizedServiceId];
        let ownershipClause = '';
        if (providerId !== undefined) {
            values.push(normalizeIdentifier(providerId, 'providerId'));
            ownershipClause = `AND s.provider_id = $${values.length}`;
        }
        const result = await pool.query(
            `SELECT sr.*
             FROM service_revisions sr
             JOIN services s ON s.id = sr.service_id
             WHERE sr.service_id = $1
               ${ownershipClause}
               AND sr.status IN ('pending', 'correction_requested')
             ORDER BY sr.revision_number DESC
             LIMIT 1`,
            values
        );
        return revisionFromRow(result.rows[0]);
    };

    const recordServiceChanges = async ({
        serviceId,
        providerId,
        proposedChanges = {},
        expectedRevisionId,
        revisionType = 'update',
    } = {}) => {
        const normalizedServiceId = normalizeIdentifier(serviceId, 'serviceId');
        const normalizedProviderId = normalizeIdentifier(providerId, 'providerId');
        assertKnownServiceChangeFields(proposedChanges);

        let normalizedExpectedRevisionId;
        if (expectedRevisionId !== undefined && expectedRevisionId !== null) {
            normalizedExpectedRevisionId = normalizeIdentifier(expectedRevisionId, 'expectedRevisionId');
        } else if (expectedRevisionId === null) {
            normalizedExpectedRevisionId = null;
        }

        return withTransaction(async (client) => {
            const serviceResult = await client.query(
                `SELECT * FROM services WHERE id = $1 FOR UPDATE`,
                [normalizedServiceId]
            );
            if (serviceResult.rows.length === 0) {
                throw new ServiceRevisionError('SERVICE_NOT_FOUND', 'Servicio no encontrado.', 404);
            }

            const lockedService = serviceResult.rows[0];
            if (lockedService.provider_id !== normalizedProviderId) {
                throw new ServiceRevisionError(
                    'SERVICE_REVISION_FORBIDDEN',
                    'No tienes autorización para modificar este Servicio.',
                    403
                );
            }

            const latestResult = await client.query(
                `SELECT *
                 FROM service_revisions
                 WHERE service_id = $1
                 ORDER BY revision_number DESC
                 LIMIT 1
                 FOR UPDATE`,
                [normalizedServiceId]
            );
            const latestRevision = latestResult.rows[0] || null;
            const currentRevision = latestRevision && ACTIVE_REVISION_STATUSES.has(latestRevision.status)
                ? latestRevision
                : null;

            if (expectedRevisionId !== undefined) {
                const actualRevisionId = currentRevision?.id || null;
                if (actualRevisionId !== normalizedExpectedRevisionId) {
                    throw new ServiceRevisionError(
                        'SERVICE_REVISION_STALE',
                        'El Servicio cambió desde que abriste el formulario.',
                        409,
                        { expectedRevisionId: normalizedExpectedRevisionId, currentRevisionId: actualRevisionId }
                    );
                }
            }

            const effectiveRevisionType = revisionType === 'creation' || (
                latestRevision?.revision_type === 'creation' && lockedService.moderation_status !== 'approved'
            ) ? 'creation' : 'update';

            const carriedProposal = currentRevision
                ? snapshotServiceFields(asObject(currentRevision.proposed_snapshot))
                : snapshotServiceFields(lockedService);
            const desiredProposal = {
                ...carriedProposal,
                ...Object.fromEntries(Object.entries(proposedChanges).filter(([, value]) => value !== undefined)),
            };
            const classification = classifyServiceChanges({
                currentService: lockedService,
                proposedChanges: desiredProposal,
                revisionType: effectiveRevisionType,
            });

            if (currentRevision) {
                const superseded = await client.query(
                    `UPDATE service_revisions
                     SET status = 'superseded',
                         superseded_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                       AND status IN ('pending', 'correction_requested')
                     RETURNING id`,
                    [currentRevision.id]
                );
                if (superseded.rows.length !== 1) {
                    throw new ServiceRevisionError(
                        'SERVICE_REVISION_STALE',
                        'La revisión vigente fue reemplazada por otra solicitud.',
                        409
                    );
                }
            }

            let publicService = lockedService;
            if (classification.autoAppliedFields.length > 0) {
                const values = [];
                const assignments = assignSql({
                    fields: classification.autoAppliedFields,
                    values,
                    proposedSnapshot: classification.proposedSnapshot,
                });
                if (classification.hasPricingChange) {
                    assignments.push('pricing_version = pricing_version + 1');
                }
                assignments.push('updated_at = CURRENT_TIMESTAMP');
                values.push(normalizedServiceId, normalizedProviderId);

                const updateResult = await client.query(
                    `UPDATE services
                     SET ${assignments.join(', ')}
                     WHERE id = $${values.length - 1}
                       AND provider_id = $${values.length}
                     RETURNING *`,
                    values
                );
                if (updateResult.rows.length !== 1) {
                    throw new ServiceRevisionError(
                        'SERVICE_REVISION_STALE',
                        'No fue posible aplicar los cambios sobre la versión vigente.',
                        409
                    );
                }
                publicService = updateResult.rows[0];
            }

            if (classification.pendingFields.length > 0 && publicService.moderation_status === 'rejected') {
                const reopened = await client.query(
                    `UPDATE services
                     SET moderation_status = 'pending',
                         moderation_reason = NULL,
                         moderated_at = NULL,
                         moderated_by = NULL,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                       AND provider_id = $2
                       AND moderation_status = 'rejected'
                     RETURNING *`,
                    [normalizedServiceId, normalizedProviderId]
                );
                if (reopened.rows.length !== 1) {
                    throw new ServiceRevisionError(
                        'SERVICE_REVISION_STALE',
                        'El estado de moderación cambió mientras reenviabas el Servicio.',
                        409
                    );
                }
                publicService = reopened.rows[0];
            }

            const sequenceResult = await client.query(
                `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision_number
                 FROM service_revisions
                 WHERE service_id = $1`,
                [normalizedServiceId]
            );
            const revisionNumber = Number(sequenceResult.rows[0]?.next_revision_number || 1);
            const status = classification.pendingFields.length > 0 ? 'pending' : 'applied';

            const inserted = await client.query(
                `INSERT INTO service_revisions (
                    service_id,
                    provider_id,
                    revision_number,
                    revision_type,
                    status,
                    review_scope,
                    before_snapshot,
                    proposed_snapshot,
                    changed_fields,
                    auto_applied_fields,
                    pending_fields,
                    review_reasons,
                    base_service_updated_at,
                    applied_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7::jsonb, $8::jsonb, $9::text[], $10::text[], $11::text[], $12::jsonb,
                    $13, CASE WHEN $5 = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END
                 )
                 RETURNING *`,
                [
                    normalizedServiceId,
                    normalizedProviderId,
                    revisionNumber,
                    effectiveRevisionType,
                    status,
                    classification.reviewScope,
                    JSON.stringify(classification.beforeSnapshot),
                    JSON.stringify(classification.proposedSnapshot),
                    classification.changedFields,
                    classification.autoAppliedFields,
                    classification.pendingFields,
                    JSON.stringify(classification.reviewReasons),
                    lockedService.updated_at,
                ]
            );

            return {
                outcome: outcomeFor(classification),
                service: serviceMetadataFromRow(publicService),
                revision: revisionFromRow(inserted.rows[0]),
                appliedFields: classification.autoAppliedFields,
                pendingFields: classification.pendingFields,
            };
        });
    };

    const recordInitialServiceRevision = (input = {}) => recordServiceChanges({
        ...input,
        revisionType: 'creation',
    });

    const createServiceWithInitialRevision = async ({ providerId, proposedChanges = {} } = {}) => {
        const normalizedProviderId = normalizeIdentifier(providerId, 'providerId');
        assertKnownServiceChangeFields(proposedChanges);

        const title = typeof proposedChanges.title === 'string' ? proposedChanges.title.trim() : '';
        const category = typeof proposedChanges.category === 'string' ? proposedChanges.category.trim() : '';
        const price = Number(proposedChanges.price);
        if (!title || !category || !Number.isSafeInteger(price) || price < 0) {
            throw new ServiceRevisionError(
                'INVALID_SERVICE_CREATION',
                'Título, categoría y precio válido son obligatorios para crear el Servicio.',
                400
            );
        }

        const creationValues = {
            title,
            description: proposedChanges.description ?? null,
            category,
            price,
            video_url: proposedChanges.video_url ?? null,
            duration_minutes: proposedChanges.duration_minutes ?? 60,
            type: proposedChanges.type ?? 'online',
            availability_type: proposedChanges.availability_type ?? 'agenda',
            calendar_config: proposedChanges.calendar_config ?? {},
            features: proposedChanges.features ?? [],
            image_urls: proposedChanges.image_urls ?? [],
            categories_json: proposedChanges.categories_json ?? [],
            cover_image_url: proposedChanges.cover_image_url ?? null,
            gallery_media: proposedChanges.gallery_media ?? [],
            pricing_type: proposedChanges.pricing_type ?? 'per_event',
            freight_base_price: proposedChanges.freight_base_price ?? null,
            freight_price_per_km: proposedChanges.freight_price_per_km ?? null,
        };

        return withTransaction(async (client) => {
            const created = await client.query(
                `INSERT INTO services (
                    provider_id,
                    title,
                    description,
                    category,
                    price,
                    video_url,
                    is_active,
                    moderation_status,
                    duration_minutes,
                    type,
                    availability_type,
                    calendar_config,
                    features,
                    image_urls,
                    categories_json,
                    cover_image_url,
                    gallery_media,
                    pricing_type,
                    freight_base_price,
                    freight_price_per_km
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, FALSE, 'pending',
                    $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
                    $14, $15::jsonb, $16, $17, $18
                 )
                 RETURNING *`,
                [
                    normalizedProviderId,
                    creationValues.title,
                    creationValues.description,
                    creationValues.category,
                    creationValues.price,
                    creationValues.video_url,
                    creationValues.duration_minutes,
                    creationValues.type,
                    creationValues.availability_type,
                    JSON.stringify(creationValues.calendar_config),
                    JSON.stringify(creationValues.features),
                    JSON.stringify(creationValues.image_urls),
                    JSON.stringify(creationValues.categories_json),
                    creationValues.cover_image_url,
                    JSON.stringify(creationValues.gallery_media),
                    creationValues.pricing_type,
                    creationValues.freight_base_price,
                    creationValues.freight_price_per_km,
                ]
            );
            const service = created.rows[0];
            if (!service) {
                throw new ServiceRevisionError(
                    'SERVICE_CREATION_FAILED',
                    'No fue posible crear el Servicio.',
                    500
                );
            }

            const classification = classifyServiceChanges({
                currentService: service,
                proposedChanges: {
                    ...snapshotServiceFields(service),
                    ...creationValues,
                    ...(proposedChanges.freight_max_distance_km !== undefined
                        ? { freight_max_distance_km: proposedChanges.freight_max_distance_km }
                        : {}),
                },
                revisionType: 'creation',
            });
            const inserted = await client.query(
                `INSERT INTO service_revisions (
                    service_id,
                    provider_id,
                    revision_number,
                    revision_type,
                    status,
                    review_scope,
                    before_snapshot,
                    proposed_snapshot,
                    changed_fields,
                    auto_applied_fields,
                    pending_fields,
                    review_reasons,
                    base_service_updated_at
                 ) VALUES (
                    $1, $2, 1, 'creation', 'pending', 'full',
                    $3::jsonb, $4::jsonb, $5::text[], $6::text[], $7::text[], $8::jsonb, $9
                 )
                 RETURNING *`,
                [
                    service.id,
                    normalizedProviderId,
                    JSON.stringify(classification.beforeSnapshot),
                    JSON.stringify(classification.proposedSnapshot),
                    classification.changedFields,
                    classification.autoAppliedFields,
                    classification.pendingFields,
                    JSON.stringify(classification.reviewReasons),
                    service.updated_at,
                ]
            );

            return {
                outcome: 'review_required',
                service: serviceMetadataFromRow(service),
                revision: revisionFromRow(inserted.rows[0]),
                appliedFields: [],
                pendingFields: classification.pendingFields,
            };
        });
    };

    const decideRevision = async ({
        revisionId,
        expectedRevisionId,
        adminId,
        decision,
        reasonCode,
        comment,
        reviewedFields,
        checklistItems,
    } = {}) => {
        const normalizedRevisionId = normalizeIdentifier(revisionId, 'revisionId');
        const normalizedExpectedRevisionId = normalizeIdentifier(expectedRevisionId, 'expectedRevisionId');
        const normalizedAdminId = normalizeIdentifier(adminId, 'adminId');
        const normalizedDecision = typeof decision === 'string' ? decision.trim().toLowerCase() : '';
        if (!DECISIONS.has(normalizedDecision)) {
            throw new ServiceRevisionError(
                'INVALID_SERVICE_REVISION_DECISION',
                'La decisión de moderación no es válida.',
                400
            );
        }
        if (normalizedExpectedRevisionId !== normalizedRevisionId) {
            throw new ServiceRevisionError(
                'SERVICE_REVISION_STALE',
                'La revisión seleccionada ya no es la vigente.',
                409
            );
        }

        const normalizedReasonCode = normalizeOptionalText(reasonCode, 80);
        const normalizedComment = normalizeOptionalText(comment, 2000);
        if (normalizedDecision !== 'approved' && !normalizedReasonCode && !normalizedComment) {
            throw new ServiceRevisionError(
                'SERVICE_REVISION_REASON_REQUIRED',
                'Debes indicar el motivo de la corrección o rechazo.',
                400
            );
        }

        return withTransaction(async (client) => {
            const lookup = await client.query(
                `SELECT service_id FROM service_revisions WHERE id = $1`,
                [normalizedRevisionId]
            );
            if (lookup.rows.length === 0) {
                throw new ServiceRevisionError('SERVICE_REVISION_NOT_FOUND', 'Revisión no encontrada.', 404);
            }

            const serviceResult = await client.query(
                `SELECT * FROM services WHERE id = $1 FOR UPDATE`,
                [lookup.rows[0].service_id]
            );
            if (serviceResult.rows.length === 0) {
                throw new ServiceRevisionError('SERVICE_NOT_FOUND', 'Servicio no encontrado.', 404);
            }

            const revisionResult = await client.query(
                `SELECT * FROM service_revisions WHERE id = $1 FOR UPDATE`,
                [normalizedRevisionId]
            );
            const revisionRow = revisionResult.rows[0];
            if (!revisionRow || revisionRow.status !== 'pending') {
                throw new ServiceRevisionError(
                    'SERVICE_REVISION_STALE',
                    'La revisión seleccionada ya fue decidida, devuelta al proveedor o reemplazada.',
                    409
                );
            }

            const pendingFields = asArray(revisionRow.pending_fields);
            const requestedReviewedFields = reviewedFields === undefined
                ? pendingFields
                : [...new Set(asArray(reviewedFields))];
            const invalidReviewedFields = requestedReviewedFields.filter((field) =>
                !SERVICE_CHANGE_FIELD_SET.has(field) || !pendingFields.includes(field)
            );
            if (invalidReviewedFields.length > 0 || (
                normalizedDecision === 'approved' && !sameFieldSet(requestedReviewedFields, pendingFields)
            )) {
                throw new ServiceRevisionError(
                    'INVALID_REVIEWED_SERVICE_FIELDS',
                    'Los campos revisados no corresponden a esta revisión.',
                    400,
                    { fields: invalidReviewedFields }
                );
            }
            const normalizedChecklistItems = [...new Set(asArray(checklistItems))];
            const invalidChecklistItems = normalizedChecklistItems.filter((item) =>
                !FULL_REVIEW_CHECKLIST_ITEM_SET.has(item)
            );
            if (invalidChecklistItems.length > 0 || (
                normalizedDecision === 'approved' &&
                revisionRow.review_scope === 'full' &&
                !sameFieldSet(normalizedChecklistItems, FULL_REVIEW_CHECKLIST_ITEMS)
            )) {
                throw new ServiceRevisionError(
                    'FULL_REVIEW_CHECKLIST_REQUIRED',
                    'Debes completar la lista de comprobación antes de aprobar una revisión completa.',
                    400,
                    { items: invalidChecklistItems }
                );
            }

            let publicService = serviceResult.rows[0];
            if (normalizedDecision === 'approved') {
                const proposedSnapshot = asObject(revisionRow.proposed_snapshot);
                const missingMediaFields = [...new Set(
                    collectReviewedLocalMedia(proposedSnapshot, pendingFields)
                        .filter(reference => !mediaExists(reference.url))
                        .map(reference => reference.field)
                )];
                if (missingMediaFields.length > 0) {
                    throw new ServiceRevisionError(
                        'SERVICE_MEDIA_UNAVAILABLE',
                        'Uno o más recursos multimedia de esta revisión ya no están disponibles. Solicita al proveedor que los reemplace antes de aprobar.',
                        409,
                        { fields: missingMediaFields }
                    );
                }
                const values = [];
                const assignments = assignSql({
                    fields: pendingFields,
                    values,
                    proposedSnapshot,
                });
                assignments.push("moderation_status = 'approved'");
                assignments.push('moderation_reason = NULL');
                assignments.push('moderated_at = CURRENT_TIMESTAMP');
                values.push(normalizedAdminId);
                assignments.push(`moderated_by = $${values.length}`);
                if (revisionRow.revision_type === 'creation') assignments.push('is_active = TRUE');
                assignments.push('updated_at = CURRENT_TIMESTAMP');
                values.push(revisionRow.service_id);

                const promoted = await client.query(
                    `UPDATE services
                     SET ${assignments.join(', ')}
                     WHERE id = $${values.length}
                     RETURNING *`,
                    values
                );
                if (promoted.rows.length !== 1) {
                    throw new ServiceRevisionError(
                        'SERVICE_REVISION_STALE',
                        'El Servicio dejó de estar disponible para esta decisión.',
                        409
                    );
                }
                publicService = promoted.rows[0];
            } else if (normalizedDecision === 'rejected' && publicService.moderation_status !== 'approved') {
                const rejected = await client.query(
                    `UPDATE services
                     SET moderation_status = 'rejected',
                         moderation_reason = $1,
                         moderated_at = CURRENT_TIMESTAMP,
                         moderated_by = $2,
                         is_active = FALSE,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3
                       AND moderation_status <> 'approved'
                     RETURNING *`,
                    [normalizedComment || normalizedReasonCode, normalizedAdminId, revisionRow.service_id]
                );
                if (rejected.rows.length !== 1) {
                    throw new ServiceRevisionError(
                        'SERVICE_REVISION_STALE',
                        'El estado de moderación cambió durante el rechazo.',
                        409
                    );
                }
                publicService = rejected.rows[0];
            }

            await client.query(
                `INSERT INTO service_revision_decisions (
                    revision_id,
                    service_id,
                    decision,
                    reason_code,
                    comment,
                    reviewed_fields,
                    checklist_items,
                    decided_by
                 ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7::text[], $8)`,
                [
                    normalizedRevisionId,
                    revisionRow.service_id,
                    normalizedDecision,
                    normalizedReasonCode,
                    normalizedComment,
                    requestedReviewedFields,
                    normalizedChecklistItems,
                    normalizedAdminId,
                ]
            );

            const decided = await client.query(
                `UPDATE service_revisions
                 SET status = $1,
                     decided_at = CURRENT_TIMESTAMP,
                     applied_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE applied_at END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                   AND status IN ('pending', 'correction_requested')
                 RETURNING *`,
                [normalizedDecision, normalizedRevisionId]
            );
            if (decided.rows.length !== 1) {
                throw new ServiceRevisionError(
                    'SERVICE_REVISION_STALE',
                    'La revisión fue decidida por otro administrador.',
                    409
                );
            }

            return {
                revision: revisionFromRow(decided.rows[0]),
                decision: {
                    decision: normalizedDecision,
                    reasonCode: normalizedReasonCode,
                    comment: normalizedComment,
                    reviewedFields: requestedReviewedFields,
                    checklistItems: normalizedChecklistItems,
                    decidedBy: normalizedAdminId,
                },
                service: serviceMetadataFromRow(publicService),
            };
        });
    };

    const listPendingRevisions = async ({ status, page = 1, pageSize = 25, search = '' } = {}) => {
        const normalizedPage = Number.parseInt(page, 10);
        const normalizedPageSize = Number.parseInt(pageSize, 10);
        if (!Number.isInteger(normalizedPage) || normalizedPage < 1 ||
            !Number.isInteger(normalizedPageSize) || normalizedPageSize < 1 || normalizedPageSize > 200) {
            throw new ServiceRevisionError(
                'INVALID_SERVICE_REVISION_PAGINATION',
                'La paginación de revisiones no es válida.',
                400
            );
        }

        const values = [];
        const predicates = [];
        if (status !== undefined && status !== null && status !== '') {
            const normalizedStatus = String(status).trim().toLowerCase();
            if (!ACTIVE_REVISION_STATUSES.has(normalizedStatus)) {
                throw new ServiceRevisionError(
                    'INVALID_SERVICE_REVISION_STATUS',
                    'El estado solicitado no corresponde a una revisión vigente.',
                    400
                );
            }
            values.push(normalizedStatus);
            predicates.push(`sr.status = $${values.length}`);
        } else {
            predicates.push("sr.status IN ('pending', 'correction_requested')");
        }

        const normalizedSearch = String(search || '').trim().slice(0, 120);
        if (normalizedSearch) {
            values.push(`%${normalizedSearch}%`);
            predicates.push(`(s.title ILIKE $${values.length} OR COALESCE(pp.full_name, '') ILIKE $${values.length})`);
        }

        values.push(normalizedPageSize, (normalizedPage - 1) * normalizedPageSize);
        const result = await pool.query(
            `SELECT
                sr.id,
                sr.service_id,
                sr.provider_id,
                sr.revision_number,
                sr.revision_type,
                sr.status,
                sr.review_scope,
                sr.changed_fields,
                sr.auto_applied_fields,
                sr.pending_fields,
                sr.review_reasons,
                sr.created_at,
                sr.updated_at,
                s.title AS service_title,
                s.is_active AS service_is_active,
                s.moderation_status AS service_moderation_status,
                s.pricing_version AS service_pricing_version,
                pp.full_name AS provider_name,
                COUNT(*) OVER() AS total_items
             FROM service_revisions sr
             JOIN services s ON s.id = sr.service_id
             LEFT JOIN provider_profiles pp ON pp.user_id = sr.provider_id
             WHERE ${predicates.join(' AND ')}
             ORDER BY sr.created_at ASC, sr.id ASC
             LIMIT $${values.length - 1}
             OFFSET $${values.length}`,
            values
        );

        const totalItems = Number(result.rows[0]?.total_items || 0);
        return {
            data: result.rows.map((row) => ({
                id: row.id,
                serviceId: row.service_id,
                providerId: row.provider_id,
                revisionNumber: Number(row.revision_number),
                revisionType: row.revision_type,
                status: row.status,
                reviewScope: row.review_scope,
                changedFields: asArray(row.changed_fields),
                autoAppliedFields: asArray(row.auto_applied_fields),
                pendingFields: asArray(row.pending_fields),
                reviewReasons: asArray(row.review_reasons),
                service: {
                    title: row.service_title,
                    isActive: Boolean(row.service_is_active),
                    moderationStatus: row.service_moderation_status,
                    pricingVersion: Number(row.service_pricing_version || 1),
                },
                provider: { name: row.provider_name || null },
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })),
            pagination: {
                page: normalizedPage,
                pageSize: normalizedPageSize,
                totalItems,
                totalPages: Math.ceil(totalItems / normalizedPageSize),
            },
        };
    };

    const getRevisionById = async ({ revisionId } = {}) => {
        const normalizedRevisionId = normalizeIdentifier(revisionId, 'revisionId');
        const result = await pool.query(
            `SELECT
                sr.*,
                s.title AS service_title,
                s.is_active AS service_is_active,
                s.moderation_status AS service_moderation_status,
                s.pricing_version AS service_pricing_version,
                pp.full_name AS provider_name
             FROM service_revisions sr
             JOIN services s ON s.id = sr.service_id
             LEFT JOIN provider_profiles pp ON pp.user_id = sr.provider_id
             WHERE sr.id = $1`,
            [normalizedRevisionId]
        );
        const row = result.rows[0];
        if (!row) {
            throw new ServiceRevisionError('SERVICE_REVISION_NOT_FOUND', 'Revisión no encontrada.', 404);
        }

        const revision = revisionFromRow(row);
        return {
            ...revision,
            effectiveSnapshot: { ...revision.beforeSnapshot, ...revision.proposedSnapshot },
            service: {
                title: row.service_title,
                isActive: Boolean(row.service_is_active),
                moderationStatus: row.service_moderation_status,
                pricingVersion: Number(row.service_pricing_version || 1),
            },
            provider: { name: row.provider_name || null },
        };
    };

    return Object.freeze({
        createServiceWithInitialRevision,
        decideRevision,
        getCurrentRevision,
        getRevisionById,
        listPendingRevisions,
        recordInitialServiceRevision,
        recordServiceChanges,
    });
};

const defaultServiceRevisionService = createServiceRevisionService();

export const decideRevision = (input) => defaultServiceRevisionService.decideRevision(input);
export const createServiceWithInitialRevision = (input) =>
    defaultServiceRevisionService.createServiceWithInitialRevision(input);
export const getCurrentRevision = (input) => defaultServiceRevisionService.getCurrentRevision(input);
export const getRevisionById = (input) => defaultServiceRevisionService.getRevisionById(input);
export const listPendingRevisions = (input) => defaultServiceRevisionService.listPendingRevisions(input);
export const recordInitialServiceRevision = (input) => defaultServiceRevisionService.recordInitialServiceRevision(input);
export const recordServiceChanges = (input) => defaultServiceRevisionService.recordServiceChanges(input);

export default defaultServiceRevisionService;
