import test from 'node:test';
import assert from 'node:assert/strict';
import { SpendTokenManager } from '../server/policies/spend_token.js';
import { PolicyEngine } from '../server/policies/policy_engine.js';
import { catalogService } from '../server/commerce/catalog.js';
import { auditStore } from '../server/database/audit_store.js';

test('Policy Engine: should ALLOW valid authorized purchase', () => {
  const token = SpendTokenManager.issueToken({
    intentId: 'intent_test_1',
    productId: 'prod_k2_v2',
    merchantId: 'keychron_in',
    priceINR: 7499,
    pricePaise: 749900,
    maxBudgetINR: 8000
  });

  const evaluation = PolicyEngine.evaluateTransaction({
    spendToken: token,
    requestedProductId: 'prod_k2_v2',
    requestedMerchantId: 'keychron_in',
    requestedAmountPaise: 749900
  });

  assert.equal(evaluation.allowed, true);
  assert.equal(evaluation.violations.length, 0);
});

test('Policy Engine: should REJECT transaction if price surges above authorized token (Price Drift Guard)', () => {
  const token = SpendTokenManager.issueToken({
    intentId: 'intent_test_surge',
    productId: 'prod_k2_v2',
    merchantId: 'keychron_in',
    priceINR: 7499,
    pricePaise: 749900,
    maxBudgetINR: 8000
  });

  // Simulate price surge in catalog
  catalogService.setPriceOverride('prod_k2_v2', 8499);

  const evaluation = PolicyEngine.evaluateTransaction({
    spendToken: token,
    requestedProductId: 'prod_k2_v2',
    requestedMerchantId: 'keychron_in',
    requestedAmountPaise: 849900
  });

  // Clean up override
  catalogService.clearPriceOverride('prod_k2_v2');

  assert.equal(evaluation.allowed, false);
  const driftViolation = evaluation.violations.find(v => v.code === 'ERR_PRICE_DRIFT_DETECTED');
  assert.ok(driftViolation, 'Must detect price drift');
});

test('Policy Engine: should REJECT unauthorized / blacklisted merchants', () => {
  const token = SpendTokenManager.issueToken({
    intentId: 'intent_test_unauth',
    productId: 'prod_k2_v2',
    merchantId: 'unauthorized_deals',
    priceINR: 7499,
    pricePaise: 749900,
    maxBudgetINR: 8000
  });

  const evaluation = PolicyEngine.evaluateTransaction({
    spendToken: token,
    requestedProductId: 'prod_k2_v2',
    requestedMerchantId: 'unauthorized_deals',
    requestedAmountPaise: 749900
  });

  assert.equal(evaluation.allowed, false);
  const merchantViolation = evaluation.violations.find(v => v.code === 'ERR_UNAUTHORIZED_MERCHANT');
  assert.ok(merchantViolation, 'Must block unauthorized merchant');
});

test('Policy Engine: should REJECT replay attack (used nonce)', () => {
  const token = SpendTokenManager.issueToken({
    intentId: 'intent_test_replay',
    productId: 'prod_k2_v2',
    merchantId: 'keychron_in',
    priceINR: 7499,
    pricePaise: 749900,
    maxBudgetINR: 8000
  });

  // Mark nonce as already used
  auditStore.usedNonces.add(token.nonce);

  const evaluation = PolicyEngine.evaluateTransaction({
    spendToken: token,
    requestedProductId: 'prod_k2_v2',
    requestedMerchantId: 'keychron_in',
    requestedAmountPaise: 749900
  });

  assert.equal(evaluation.allowed, false);
  const replayViolation = evaluation.violations.find(v => v.code === 'ERR_NONCE_ALREADY_USED');
  assert.ok(replayViolation, 'Must block replayed nonce');
});

test('Policy Engine: should REJECT out-of-stock items', () => {
  const token = SpendTokenManager.issueToken({
    intentId: 'intent_test_oos',
    productId: 'prod_out_of_stock',
    merchantId: 'keychron_in',
    priceINR: 7999,
    pricePaise: 799900,
    maxBudgetINR: 8000
  });

  const evaluation = PolicyEngine.evaluateTransaction({
    spendToken: token,
    requestedProductId: 'prod_out_of_stock',
    requestedMerchantId: 'keychron_in',
    requestedAmountPaise: 799900
  });

  assert.equal(evaluation.allowed, false);
  const oosViolation = evaluation.violations.find(v => v.code === 'ERR_OUT_OF_STOCK');
  assert.ok(oosViolation, 'Must block out of stock product');
});
