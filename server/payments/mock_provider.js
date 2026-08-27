import crypto from 'crypto';
import { PaymentVerifier } from './verifier.js';

export class MockRazorpayProvider {
  constructor(keySecret = 'mock_secret_key_abcdef') {
    this.keySecret = keySecret;
    this.orders = new Map();
    this.payments = new Map();
  }

  /**
   * Simulate Razorpay Order Creation
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    const order = {
      id: orderId,
      entity: 'order',
      amount,
      amount_paid: 0,
      amount_due: amount,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes,
      created_at: Math.floor(Date.now() / 1000),
      _isSimulated: true
    };

    this.orders.set(orderId, order);
    return order;
  }

  /**
   * Simulate Razorpay Test Mode Payment Submission & Signature Generation
   */
  async simulatePayment({ orderId, shouldFail = false, failureReason = 'CARD_DECLINED' }) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found in mock gateway`);
    }

    const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
    
    if (shouldFail) {
      const failedPayment = {
        id: paymentId,
        entity: 'payment',
        amount: order.amount,
        currency: order.currency,
        status: 'failed',
        order_id: orderId,
        error_code: 'BAD_REQUEST_ERROR',
        error_description: failureReason,
        _isSimulated: true
      };
      this.payments.set(paymentId, failedPayment);
      return failedPayment;
    }

    // Generate authentic HMAC-SHA256 signature for the mock payment
    const signature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const payment = {
      id: paymentId,
      entity: 'payment',
      amount: order.amount,
      currency: order.currency,
      status: 'captured',
      order_id: orderId,
      method: 'upi_agent_reserve',
      razorpay_signature: signature,
      created_at: Math.floor(Date.now() / 1000),
      _isSimulated: true
    };

    order.status = 'paid';
    order.amount_paid = order.amount;
    order.amount_due = 0;

    this.payments.set(paymentId, payment);
    return payment;
  }

  /**
   * Verify signature using the standard PaymentVerifier
   */
  verifySignature({ orderId, paymentId, signature }) {
    return PaymentVerifier.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      keySecret: this.keySecret
    });
  }

  fetchOrder(orderId) {
    return this.orders.get(orderId) || null;
  }

  fetchPayment(paymentId) {
    return this.payments.get(paymentId) || null;
  }
}
