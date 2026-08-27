import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { PaymentVerifier } from '../server/payments/verifier.js';
import { MockRazorpayProvider } from '../server/payments/mock_provider.js';

test('Payment Verifier: should verify authentic Razorpay HMAC-SHA256 signatures', () => {
  const orderId = 'order_test_123456';
  const paymentId = 'pay_test_789012';
  const keySecret = 'test_secret_key_abcdef';

  const validSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const verification = PaymentVerifier.verifyPaymentSignature({
    orderId,
    paymentId,
    signature: validSignature,
    keySecret
  });

  assert.equal(verification.isValid, true);
  assert.equal(verification.error, null);
});

test('Payment Verifier: should reject forged / tampered signatures', () => {
  const orderId = 'order_test_123456';
  const paymentId = 'pay_test_789012';
  const keySecret = 'test_secret_key_abcdef';
  const forgedSignature = 'forged_fake_signature_hash_00000000000000000000000000000000';

  const verification = PaymentVerifier.verifyPaymentSignature({
    orderId,
    paymentId,
    signature: forgedSignature,
    keySecret
  });

  assert.equal(verification.isValid, false);
});

test('Mock Razorpay Provider: should create valid order and simulate capture', async () => {
  const provider = new MockRazorpayProvider('mock_secret_key');
  const order = await provider.createOrder({
    amount: 749900,
    currency: 'INR',
    receipt: 'rcpt_unit_test'
  });

  assert.ok(order.id.startsWith('order_mock_'));
  assert.equal(order.amount, 749900);
  assert.equal(order.status, 'created');

  const payment = await provider.simulatePayment({ orderId: order.id, shouldFail: false });
  assert.equal(payment.status, 'captured');
  assert.ok(payment.razorpay_signature);

  const sigCheck = provider.verifySignature({
    orderId: order.id,
    paymentId: payment.id,
    signature: payment.razorpay_signature
  });

  assert.equal(sigCheck.isValid, true);
});

test('Mock Razorpay Provider: should simulate payment failure honestly', async () => {
  const provider = new MockRazorpayProvider('mock_secret_key');
  const order = await provider.createOrder({ amount: 500000, currency: 'INR' });
  const payment = await provider.simulatePayment({
    orderId: order.id,
    shouldFail: true,
    failureReason: 'INSUFFICIENT_FUNDS'
  });

  assert.equal(payment.status, 'failed');
  assert.equal(payment.error_description, 'INSUFFICIENT_FUNDS');
});
