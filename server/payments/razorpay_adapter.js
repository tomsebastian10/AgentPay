import Razorpay from 'razorpay';
import { config } from '../config.js';
import { PaymentVerifier } from './verifier.js';
import { MockRazorpayProvider } from './mock_provider.js';
import { auditStore } from '../database/audit_store.js';

class RazorpayAdapter {
  constructor() {
    this.mode = config.razorpay.mode;
    this.keyId = config.razorpay.keyId;
    this.keySecret = config.razorpay.keySecret;
    this.mockProvider = new MockRazorpayProvider(this.keySecret);

    if (this.mode === 'test') {
      try {
        this.client = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret
        });
        console.log('✅ Razorpay Test Mode Client initialized successfully with Key ID:', this.keyId);
      } catch (err) {
        console.warn('⚠️ Razorpay Client init failed, defaulting to Mock Provider:', err.message);
        this.mode = 'mock';
      }
    } else {
      console.log('ℹ️ Running in Mock Gateway Mode for offline/reproducible test suite.');
    }
  }

  /**
   * Create Razorpay Order
   */
  async createOrder({ amountPaise, currency = 'INR', receipt, notes = {}, intentId }) {
    try {
      let orderResult;
      
      if (this.mode === 'test' && this.client) {
        orderResult = await this.client.orders.create({
          amount: amountPaise,
          currency,
          receipt,
          notes,
          partial_payment: false
        });
        orderResult._isSimulated = false;
      } else {
        orderResult = await this.mockProvider.createOrder({
          amount: amountPaise,
          currency,
          receipt,
          notes
        });
      }

      auditStore.logEvent({
        intentId: intentId || notes.intent_id || 'unknown',
        eventType: 'ORDER_CREATED',
        status: 'SUCCESS',
        details: {
          orderId: orderResult.id,
          amountPaise,
          currency,
          isSimulated: orderResult._isSimulated,
          gatewayMode: this.mode
        }
      });

      return orderResult;
    } catch (error) {
      auditStore.logEvent({
        intentId: intentId || notes.intent_id || 'unknown',
        eventType: 'ORDER_CREATED',
        status: 'PAYMENT_FAILED',
        details: {
          error: error.message,
          amountPaise,
          gatewayMode: this.mode
        }
      });
      throw error;
    }
  }

  /**
   * Verify Payment Signature (HMAC-SHA256)
   */
  verifyPayment({ orderId, paymentId, signature, intentId }) {
    const result = PaymentVerifier.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      keySecret: this.keySecret
    });

    auditStore.logEvent({
      intentId: intentId || 'unknown',
      eventType: 'PAYMENT_VERIFIED',
      status: result.isValid ? 'SUCCESS' : 'VIOLATION_BLOCKED',
      details: {
        orderId,
        paymentId,
        isValid: result.isValid,
        error: result.error,
        gatewayMode: this.mode
      }
    });

    return result;
  }

  /**
   * Simulate a test payment execution (for automated testing or frontend simulation)
   */
  async simulatePayment({ orderId, shouldFail = false, failureReason, intentId }) {
    const payment = await this.mockProvider.simulatePayment({ orderId, shouldFail, failureReason });
    
    auditStore.logEvent({
      intentId: intentId || 'unknown',
      eventType: 'PAYMENT_ATTEMPT',
      status: payment.status === 'captured' ? 'SUCCESS' : 'PAYMENT_FAILED',
      details: {
        orderId,
        paymentId: payment.id,
        status: payment.status,
        error: payment.error_description || null
      }
    });

    return payment;
  }

  getMode() {
    return {
      mode: this.mode,
      keyId: this.keyId,
      isRealTestMode: this.mode === 'test'
    };
  }
}

export const razorpayAdapter = new RazorpayAdapter();
