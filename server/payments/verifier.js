import crypto from 'crypto';

export class PaymentVerifier {
  /**
   * Verify Razorpay Payment Signature (HMAC-SHA256)
   * Formula: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
   */
  static verifyPaymentSignature({ orderId, paymentId, signature, keySecret }) {
    if (!orderId || !paymentId || !signature || !keySecret) {
      return {
        isValid: false,
        error: 'Missing required parameters for signature verification.'
      };
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const expectedBuffer = Buffer.from(generatedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return {
          isValid: false,
          error: 'Signature length mismatch'
        };
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
      return {
        isValid,
        error: isValid ? null : 'Cryptographic HMAC-SHA256 signature mismatch.'
      };
    } catch (err) {
      return {
        isValid: false,
        error: `Verification exception: ${err.message}`
      };
    }
  }

  /**
   * Verify Razorpay Webhook Signature
   */
  static verifyWebhookSignature({ rawBody, signature, webhookSecret }) {
    if (!rawBody || !signature || !webhookSecret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }
}
