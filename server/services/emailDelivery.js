export const deliverEmail = async ({
    send,
    payload,
    errorCode,
    errorMessage,
    onDelivered = async () => {},
} = {}) => {
    if (typeof send !== 'function') {
        throw new TypeError('An email sender is required');
    }

    const delivered = await send(payload);
    if (delivered !== true) {
        const error = new Error(errorMessage || 'Email delivery was rejected');
        error.code = errorCode || 'EMAIL_DELIVERY_FAILED';
        throw error;
    }

    await onDelivered();
    return true;
};

export default deliverEmail;
