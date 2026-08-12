export const BOOKING_TRANSITIONS = Object.freeze({
    pending_payment: Object.freeze(['cancelled']),
    in_escrow: Object.freeze(['service_completed', 'disputed', 'cancelled']),
    service_completed: Object.freeze(['released', 'disputed']),
    disputed: Object.freeze(['released', 'cancelled']),
    cancelled: Object.freeze([]),
    released: Object.freeze([]),
});

const ROLE_TARGETS = Object.freeze({
    admin: new Set(['cancelled', 'service_completed', 'disputed', 'released']),
    provider: new Set(['cancelled', 'service_completed']),
    client: new Set(['cancelled', 'disputed', 'released']),
});

export const validateBookingTransition = ({
    currentStatus,
    targetStatus,
    role,
    actorId,
    clientId,
    providerId,
} = {}) => {
    const transitions = BOOKING_TRANSITIONS[currentStatus];
    if (!transitions || !Object.hasOwn(BOOKING_TRANSITIONS, targetStatus)) {
        return { ok: false, code: 'INVALID_BOOKING_STATUS' };
    }

    if (!transitions.includes(targetStatus)) {
        return { ok: false, code: 'INVALID_BOOKING_TRANSITION' };
    }

    if (!ROLE_TARGETS[role]?.has(targetStatus)) {
        return { ok: false, code: 'BOOKING_TRANSITION_FORBIDDEN' };
    }

    if (role === 'client' && String(clientId) !== String(actorId)) {
        return { ok: false, code: 'BOOKING_TRANSITION_FORBIDDEN' };
    }

    if (role === 'provider' && String(providerId) !== String(actorId)) {
        return { ok: false, code: 'BOOKING_TRANSITION_FORBIDDEN' };
    }

    return { ok: true };
};

export default {
    BOOKING_TRANSITIONS,
    validateBookingTransition,
};
