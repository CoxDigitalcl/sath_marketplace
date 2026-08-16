import assert from 'node:assert/strict';
import test from 'node:test';

import { deliverEmail } from '../services/emailDelivery.js';

test('SMTP rejection exposes a stable retry code and does not checkpoint delivery', async () => {
    let checkpointed = false;

    await assert.rejects(
        deliverEmail({
            send: async () => false,
            payload: { to: 'client@example.test' },
            errorCode: 'CLIENT_EMAIL_DELIVERY_FAILED',
            errorMessage: 'Client contact email was rejected',
            onDelivered: async () => { checkpointed = true; },
        }),
        (error) => error.code === 'CLIENT_EMAIL_DELIVERY_FAILED',
    );

    assert.equal(checkpointed, false);
});

test('accepted email checkpoints delivery before reporting success', async () => {
    const order = [];
    const result = await deliverEmail({
        send: async () => {
            order.push('accepted');
            return true;
        },
        payload: { to: 'provider@example.test' },
        onDelivered: async () => { order.push('checkpointed'); },
    });

    assert.equal(result, true);
    assert.deepEqual(order, ['accepted', 'checkpointed']);
});
