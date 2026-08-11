import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePaykuPaymentVerification,
  validatePaykuWebhookPayload,
} from '../services/paykuPaymentIntegrity.js';

const BOOKING_ID = 'fa6e9af9-f935-4b2e-8fb7-1af35503bd8f';

const validPayload = () => ({
  transaction_id: 107999,
  payment_key: 'trx3b4d77b43acd9a720',
  transaction_key: 'dv032360ead078acd4b',
  verification_key: '6669cbd982ef54c28f2f15fb9dc5262d',
  order: BOOKING_ID,
  status: 'success',
});

const validBooking = () => ({
  id: BOOKING_ID,
  status: 'pending_payment',
  amount: 25000,
  transaction_id: 'trx3b4d77b43acd9a720',
});

const validVerification = () => ({
  status: 'success',
  id: 'trx3b4d77b43acd9a720',
  order: BOOKING_ID,
  amount: '25000',
  payment: {
    transaction_id: 107999,
    payment_key: 'pra934939d607922f9e',
    transaction_key: 'dv032360ead078acd4b',
    verification_key: '6669cbd982ef54c28f2f15fb9dc5262d',
    currency: 'CLP',
  },
  gateway_response: {
    status: 'success',
  },
});

const buildContext = ({ payload = validPayload(), booking = validBooking(), verification = validVerification() } = {}) => {
  const payloadResult = validatePaykuWebhookPayload(payload);
  assert.equal(payloadResult.ok, true);

  return {
    booking,
    callback: payloadResult.value,
    verification,
  };
};

test('accepts a Payku verification only when all documented payment facts match', () => {
  const result = validatePaykuPaymentVerification(buildContext());

  assert.deepEqual(result, {
    ok: true,
    value: {
      bookingId: BOOKING_ID,
      paymentKey: 'trx3b4d77b43acd9a720',
      gatewayTransactionId: '107999',
      status: 'success',
      amount: 25000,
      currency: 'CLP',
    },
  });
});

test('requires all security-relevant callback identifiers and a successful status', () => {
  for (const field of ['order', 'payment_key', 'transaction_id', 'verification_key', 'status']) {
    const payload = validPayload();
    delete payload[field];

    assert.equal(validatePaykuWebhookPayload(payload).ok, false, `expected ${field} to be required`);
  }

  assert.deepEqual(validatePaykuWebhookPayload({ ...validPayload(), status: 'pending' }), {
    ok: false,
    code: 'CALLBACK_NOT_SUCCESSFUL',
  });
});

test('rejects substitution of a paid transaction onto a different booking order', () => {
  const result = validatePaykuPaymentVerification(buildContext({
    payload: { ...validPayload(), order: '9b91aa6c-fe11-4c60-92e4-ea375455a1a4' },
  }));

  assert.deepEqual(result, { ok: false, code: 'ORDER_MISMATCH' });
});

test('rejects a verified Payku id that differs from the payment key saved at checkout', () => {
  const result = validatePaykuPaymentVerification(buildContext({
    verification: { ...validVerification(), id: 'trx-other-payment' },
  }));

  assert.deepEqual(result, { ok: false, code: 'VERIFIED_PAYMENT_KEY_MISMATCH' });
});

test('rejects callback and verified bank transaction id mismatch', () => {
  const verification = validVerification();
  verification.payment.transaction_id = 108000;

  const result = validatePaykuPaymentVerification(buildContext({ verification }));

  assert.deepEqual(result, { ok: false, code: 'VERIFIED_GATEWAY_TRANSACTION_ID_MISMATCH' });
});

test('rejects callback and verified verification key mismatch', () => {
  const verification = validVerification();
  verification.payment.verification_key = 'different-verification-key';

  const result = validatePaykuPaymentVerification(buildContext({ verification }));

  assert.deepEqual(result, { ok: false, code: 'VERIFIED_VERIFICATION_KEY_MISMATCH' });
});

test('fails closed when amount or currency are missing, malformed, or different', () => {
  const cases = [
    [{ ...validVerification(), amount: undefined }, 'MISSING_VERIFIED_AMOUNT'],
    [{ ...validVerification(), amount: '25000 CLP' }, 'MISSING_VERIFIED_AMOUNT'],
    [{ ...validVerification(), amount: '24999' }, 'VERIFIED_AMOUNT_MISMATCH'],
    [{ ...validVerification(), payment: { ...validVerification().payment, currency: undefined } }, 'MISSING_VERIFIED_CURRENCY'],
    [{ ...validVerification(), payment: { ...validVerification().payment, currency: 'USD' } }, 'VERIFIED_CURRENCY_MISMATCH'],
  ];

  for (const [verification, expectedCode] of cases) {
    const result = validatePaykuPaymentVerification(buildContext({ verification }));
    assert.deepEqual(result, { ok: false, code: expectedCode });
  }
});

test('rejects a contradictory gateway status even when root status says success', () => {
  const verification = validVerification();
  verification.gateway_response.status = 'rejected';

  const result = validatePaykuPaymentVerification(buildContext({ verification }));

  assert.deepEqual(result, { ok: false, code: 'GATEWAY_STATUS_NOT_SUCCESSFUL' });
});
