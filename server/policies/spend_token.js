import crypto from 'crypto';
import { config } from '../config.js';

export class SpendTokenManager {
  /**
   * Compute HMAC signature for spend token payload
   */
  static generateSignature(payload) {
    const message = [
      payload.tokenId,
      payload.intentId,
      payload.productId,
      payload.merchantId,
      payload.authorizedAmountPaise,
      payload.nonce,
      payload.expiresAt
    ].join('|');

    return crypto
      .createHmac('sha256', config.authSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Issue a signed SpendAuthorizationToken (AP2 standard pattern)
   */
  static issueToken({ intentId, productId, merchantId, priceINR, pricePaise, maxBudgetINR }) {
    const tokenId = `sat_${crypto.randomUUID()}`;
    const nonce = `nonce_${crypto.randomBytes(16).toString('hex')}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + config.safety.spendTokenTTLSeconds * 1000).toISOString();

    const payload = {
      tokenId,
      intentId,
      productId,
      merchantId,
      authorizedAmountINR: priceINR,
      authorizedAmountPaise: pricePaise,
      maxBudgetINR,
      currency: 'INR',
      nonce,
      issuedAt,
      expiresAt,
      protocol: 'AP2-SpendAuthorization-v1'
    };

    const signature = this.generateSignature(payload);

    return {
      ...payload,
      signature
    };
  }

  /**
   * Verify token signature and expiration
   */
  static verifyToken(token) {
    if (!token || !token.signature || !token.tokenId) {
      return { isValid: false, error: 'Malformed authorization token' };
    }

    // Check expiration
    if (new Date(token.expiresAt).getTime() < Date.now()) {
      return { isValid: false, error: 'Spend authorization token has expired' };
    }

    // Verify HMAC-SHA256 signature
    const expectedSig = this.generateSignature(token);
    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSig, 'utf8'),
      Buffer.from(token.signature, 'utf8')
    );

    if (!isValidSignature) {
      return { isValid: false, error: 'Cryptographic signature mismatch on spend token' };
    }

    return { isValid: true };
  }
}
