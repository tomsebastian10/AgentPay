import { config } from '../config.js';
import { AUTHORIZED_MERCHANT_IDS } from '../commerce/merchants.js';
import { catalogService } from '../commerce/catalog.js';
import { auditStore } from '../database/audit_store.js';
import { SpendTokenManager } from './spend_token.js';

export class PolicyEngine {
  /**
   * Deterministically validate a transaction before any payment API call
   */
  static evaluateTransaction({ spendToken, requestedProductId, requestedMerchantId, requestedAmountPaise }) {
    const violations = [];

    // Invariant 1: Spend Token Integrity & Cryptographic Signature
    const tokenVerification = SpendTokenManager.verifyToken(spendToken);
    if (!tokenVerification.isValid) {
      violations.push({
        code: 'ERR_INVALID_TOKEN_SIGNATURE',
        message: tokenVerification.error
      });
    }

    // Invariant 2: Replay Attack Defense (Single-Use Nonce Check)
    if (spendToken?.nonce && auditStore.isNonceUsed(spendToken.nonce)) {
      violations.push({
        code: 'ERR_NONCE_ALREADY_USED',
        message: 'Spend token nonce has already been consumed. Replay attempt detected and blocked.'
      });
    }

    // Invariant 3: Product and Merchant Association
    if (spendToken && requestedProductId && spendToken.productId !== requestedProductId) {
      violations.push({
        code: 'ERR_PRODUCT_MISMATCH',
        message: `Token was authorized for product ${spendToken.productId}, but transaction requested ${requestedProductId}.`
      });
    }

    if (spendToken && requestedMerchantId && spendToken.merchantId !== requestedMerchantId) {
      violations.push({
        code: 'ERR_MERCHANT_MISMATCH',
        message: `Token was authorized for merchant ${spendToken.merchantId}, but transaction requested ${requestedMerchantId}.`
      });
    }

    // Invariant 4: Merchant Whitelist Check
    const targetMerchantId = requestedMerchantId || spendToken?.merchantId;
    if (!AUTHORIZED_MERCHANT_IDS.includes(targetMerchantId)) {
      violations.push({
        code: 'ERR_UNAUTHORIZED_MERCHANT',
        message: `Merchant ${targetMerchantId} is not on the authorized merchant registry.`
      });
    }

    // Invariant 5: Live Price Drift & Price Surge Invariance Check
    const targetProductId = requestedProductId || spendToken?.productId;
    const currentLivePriceINR = catalogService.getEffectivePrice(targetProductId);
    const currentLivePricePaise = Math.round(currentLivePriceINR * 100);

    if (spendToken && currentLivePricePaise !== spendToken.authorizedAmountPaise) {
      violations.push({
        code: 'ERR_PRICE_DRIFT_DETECTED',
        message: `Live price (₹${currentLivePriceINR}) does not match authorized price (₹${spendToken.authorizedAmountINR}). Transaction rejected due to price change.`
      });
    }

    // Invariant 6: Hard Budget Boundary
    if (spendToken && currentLivePriceINR > spendToken.maxBudgetINR) {
      violations.push({
        code: 'ERR_BUDGET_EXCEEDED',
        message: `Current price ₹${currentLivePriceINR} exceeds user budget of ₹${spendToken.maxBudgetINR}.`
      });
    }

    // Invariant 7: System Single-Transaction Cap
    if (currentLivePriceINR > config.safety.maxSingleTransactionLimitINR) {
      violations.push({
        code: 'ERR_SYSTEM_LIMIT_EXCEEDED',
        message: `Amount ₹${currentLivePriceINR} exceeds maximum system single-transaction ceiling of ₹${config.safety.maxSingleTransactionLimitINR}.`
      });
    }

    // Invariant 8: Real-Time Inventory / Stock Availability Check
    const product = catalogService.getProductById(targetProductId);
    if (!product || !product.inStock || product.stockCount <= 0) {
      violations.push({
        code: 'ERR_OUT_OF_STOCK',
        message: `Product ${targetProductId} is currently out of stock.`
      });
    }

    const isAllowed = violations.length === 0;

    if (isAllowed && spendToken?.nonce) {
      auditStore.consumeNonce(spendToken.nonce);
    }

    // Log policy evaluation result into immutable audit trail
    auditStore.logEvent({
      intentId: spendToken?.intentId || 'unknown',
      eventType: 'POLICY_EVALUATION',
      status: isAllowed ? 'SUCCESS' : 'VIOLATION_BLOCKED',
      details: {
        allowed: isAllowed,
        violations,
        evaluatedProduct: targetProductId,
        evaluatedMerchant: targetMerchantId,
        authorizedAmountINR: spendToken?.authorizedAmountINR,
        livePriceINR: currentLivePriceINR,
        nonce: spendToken?.nonce
      }
    });

    return {
      allowed: isAllowed,
      violations,
      evaluatedPriceINR: currentLivePriceINR,
      evaluatedPricePaise: currentLivePricePaise
    };
  }
}
