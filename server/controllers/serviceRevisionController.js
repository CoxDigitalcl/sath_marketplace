import logger from '../config/logger.js';
import cacheService from '../services/cacheService.js';
import { createInAppNotification } from './notificationController.js';
import {
    decideRevision,
    getRevisionById,
    listPendingRevisions,
    ServiceRevisionError,
} from '../services/serviceRevisionService.js';
import {
    formatServiceValidationError,
    serviceRevisionDecisionSchema,
    serviceRevisionListQuerySchema,
} from '../utils/serviceRevisionValidation.js';

const respondWithRevisionError = (res, error) => {
    if (!(error instanceof ServiceRevisionError)) return false;
    res.status(error.statusCode || 400).json({
        status: 'error',
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
    });
    return true;
};

const notificationForDecision = ({ decision, serviceTitle, comment }) => {
    if (decision === 'approved') {
        return {
            title: 'Cambios del Servicio aprobados',
            message: `La revisión de “${serviceTitle}” fue aprobada.`,
            type: 'success',
        };
    }
    if (decision === 'correction_requested') {
        return {
            title: 'Tu Servicio requiere una corrección',
            message: `Debes corregir “${serviceTitle}”: ${comment}`,
            type: 'warning',
        };
    }
    return {
        title: 'Cambios del Servicio rechazados',
        message: `La propuesta para “${serviceTitle}” fue rechazada: ${comment}`,
        type: 'error',
    };
};

export const getServiceRevisionQueue = async (req, res, next) => {
    const parsed = serviceRevisionListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json(formatServiceValidationError(parsed.error));
    }

    try {
        const result = await listPendingRevisions(parsed.data);
        return res.json({
            status: 'success',
            revisions: result.data,
            pagination: result.pagination,
        });
    } catch (error) {
        if (respondWithRevisionError(res, error)) return;
        next(error);
    }
};

export const getServiceRevisionDetail = async (req, res, next) => {
    try {
        const revision = await getRevisionById({ revisionId: req.params.revisionId });
        return res.json({ status: 'success', revision });
    } catch (error) {
        if (respondWithRevisionError(res, error)) return;
        next(error);
    }
};

export const createServiceRevisionDecision = async (req, res, next) => {
    const parsed = serviceRevisionDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(formatServiceValidationError(parsed.error));
    }

    try {
        const beforeDecision = await getRevisionById({ revisionId: req.params.revisionId });
        const result = await decideRevision({
            revisionId: req.params.revisionId,
            adminId: req.user.id,
            ...parsed.data,
        });

        if (parsed.data.decision === 'approved') {
            try {
                cacheService.flush();
            } catch (error) {
                logger.warn(`No se pudo invalidar el cache tras aprobar revisión de Servicio: ${error.message}`);
            }
        }

        const notification = notificationForDecision({
            decision: parsed.data.decision,
            serviceTitle: beforeDecision.service?.title || 'tu Servicio',
            comment: parsed.data.comment || 'Revisa el detalle en Gestión de Servicios.',
        });
        void createInAppNotification({
            userId: beforeDecision.providerId,
            ...notification,
        });

        const message = parsed.data.decision === 'approved'
            ? 'Cambios aprobados y aplicados.'
            : parsed.data.decision === 'correction_requested'
                ? 'Corrección solicitada al proveedor.'
                : 'Cambios rechazados.';

        return res.json({ status: 'success', message, ...result });
    } catch (error) {
        if (respondWithRevisionError(res, error)) return;
        logger.error(`Service revision decision failed: ${error.message}`);
        next(error);
    }
};
