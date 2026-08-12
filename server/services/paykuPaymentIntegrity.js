const PAYKU_SUCCESS_STATUS = 'success';
const PAYKU_CURRENCY = 'CLP';
const MAX_IDENTIFIER_LENGTH = 255;

const failure = (code) => ({ ok: false, code });

const normalizeIdentifier = (value, maxLength = MAX_IDENTIFIER_LENGTH) => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const normalized = String(value).trim();
    if (!normalized || normalized.length > maxLength) return null;

    return normalized;
};

const normalizeOptionalIdentifier = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return normalizeIdentifier(value);
};

const normalizeClpAmount = (value) => {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value >= 0 ? value : null;
    }

    if (typeof value !== 'string') return null;

    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) return null;

    const amount = Number(normalized);
    return Number.isSafeInteger(amount) ? amount : null;
};

/**
 * Normalizes the documented Payku callback fields without trusting them as proof
 * of payment. Every required capability/identifier must be present before an API
 * verification is attempted.
 */
export const validatePaykuWebhookPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return failure('INVALID_PAYLOAD');
    }

    const order = normalizeIdentifier(payload.order, 64);
    const paymentKey = normalizeIdentifier(payload.payment_key);
    const gatewayTransactionId = normalizeIdentifier(payload.transaction_id);
    const verificationKey = normalizeIdentifier(payload.verification_key);
    const transactionKey = normalizeOptionalIdentifier(payload.transaction_key);
    const status = typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : null;

    if (!order) return failure('MISSING_ORDER');
    if (!paymentKey) return failure('MISSING_PAYMENT_KEY');
    if (!gatewayTransactionId) return failure('MISSING_GATEWAY_TRANSACTION_ID');
    if (!verificationKey) return failure('MISSING_VERIFICATION_KEY');
    if (!status) return failure('MISSING_STATUS');
    if (status !== PAYKU_SUCCESS_STATUS) return failure('CALLBACK_NOT_SUCCESSFUL');

    return {
        ok: true,
        value: {
            order,
            paymentKey,
            gatewayTransactionId,
            verificationKey,
            transactionKey,
            status,
        },
    };
};

/**
 * Binds a server-to-server Payku verification response to both the callback and
 * the immutable booking facts. Missing verification fields fail closed.
 */
export const validatePaykuPaymentVerification = ({ booking, callback, verification }) => {
    if (!booking || !callback || !verification || typeof verification !== 'object' || Array.isArray(verification)) {
        return failure('INVALID_VERIFICATION_CONTEXT');
    }

    const bookingId = normalizeIdentifier(booking.id, 64);
    const storedPaymentKey = normalizeIdentifier(booking.transaction_id);
    const bookingAmount = normalizeClpAmount(booking.amount);

    if (!bookingId || !storedPaymentKey || bookingAmount === null) {
        return failure('INVALID_BOOKING_PAYMENT_DATA');
    }

    if (callback.order !== bookingId) return failure('ORDER_MISMATCH');
    if (callback.paymentKey !== storedPaymentKey) return failure('PAYMENT_KEY_MISMATCH');

    const verifiedStatus = typeof verification.status === 'string'
        ? verification.status.trim().toLowerCase()
        : null;
    const verifiedPaymentKey = normalizeIdentifier(verification.id);
    const verifiedOrder = normalizeIdentifier(verification.order, 64);
    const verifiedAmount = normalizeClpAmount(verification.amount);
    const verifiedCurrencyRaw = verification.payment?.currency ?? verification.currency;
    const verifiedCurrency = typeof verifiedCurrencyRaw === 'string'
        ? verifiedCurrencyRaw.trim().toUpperCase()
        : null;
    const verifiedGatewayTransactionId = normalizeIdentifier(
        verification.payment?.transaction_id ?? verification.transaction_id
    );
    const verifiedVerificationKey = normalizeIdentifier(
        verification.payment?.verification_key ?? verification.verification_key
    );
    const verifiedTransactionKey = normalizeOptionalIdentifier(
        verification.payment?.transaction_key ?? verification.transaction_key
    );
    const gatewayStatus = typeof verification.gateway_response?.status === 'string'
        ? verification.gateway_response.status.trim().toLowerCase()
        : null;

    if (verifiedStatus !== PAYKU_SUCCESS_STATUS) return failure('VERIFIED_STATUS_NOT_SUCCESSFUL');
    if (gatewayStatus && gatewayStatus !== PAYKU_SUCCESS_STATUS) return failure('GATEWAY_STATUS_NOT_SUCCESSFUL');
    if (!verifiedPaymentKey || verifiedPaymentKey !== storedPaymentKey) return failure('VERIFIED_PAYMENT_KEY_MISMATCH');
    if (!verifiedOrder || verifiedOrder !== bookingId) return failure('VERIFIED_ORDER_MISMATCH');
    if (verifiedAmount === null) return failure('MISSING_VERIFIED_AMOUNT');
    if (verifiedAmount !== bookingAmount) return failure('VERIFIED_AMOUNT_MISMATCH');
    if (!verifiedCurrency) return failure('MISSING_VERIFIED_CURRENCY');
    if (verifiedCurrency !== PAYKU_CURRENCY) return failure('VERIFIED_CURRENCY_MISMATCH');
    if (!verifiedGatewayTransactionId) return failure('MISSING_VERIFIED_GATEWAY_TRANSACTION_ID');
    if (verifiedGatewayTransactionId !== callback.gatewayTransactionId) {
        return failure('VERIFIED_GATEWAY_TRANSACTION_ID_MISMATCH');
    }
    if (!verifiedVerificationKey) return failure('MISSING_VERIFIED_VERIFICATION_KEY');
    if (verifiedVerificationKey !== callback.verificationKey) {
        return failure('VERIFIED_VERIFICATION_KEY_MISMATCH');
    }
    // Payku may include transaction_key in the callback while omitting it from
    // the authoritative GET response. Compare it only when verification exposes
    // a value; the mandatory gateway and verification identifiers above remain bound.
    if (verifiedTransactionKey && callback.transactionKey !== verifiedTransactionKey) {
        return failure('VERIFIED_TRANSACTION_KEY_MISMATCH');
    }

    return {
        ok: true,
        value: {
            bookingId,
            paymentKey: storedPaymentKey,
            gatewayTransactionId: verifiedGatewayTransactionId,
            status: verifiedStatus,
            amount: verifiedAmount,
            currency: verifiedCurrency,
        },
    };
};

export default {
    validatePaykuWebhookPayload,
    validatePaykuPaymentVerification,
};
