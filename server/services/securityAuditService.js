import { pool } from '../config/db.js';

const ALLOWED_OUTCOMES = new Set(['SUCCESS', 'DENIED', 'FAILED']);

export const recordAdminSecurityEvent = async ({
    actorAdminId,
    targetUserId = null,
    action,
    outcome,
    correlationId = null,
    metadata = {}
}, queryable = pool) => {
    if (!actorAdminId || typeof action !== 'string' || !ALLOWED_OUTCOMES.has(outcome)) {
        throw new Error('Invalid admin security event.');
    }

    await queryable.query(
        `INSERT INTO admin_security_events
            (actor_admin_id, target_user_id, action, outcome, correlation_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
            actorAdminId,
            targetUserId,
            action.slice(0, 80),
            outcome,
            correlationId ? String(correlationId).slice(0, 64) : null,
            JSON.stringify(metadata)
        ]
    );
};
