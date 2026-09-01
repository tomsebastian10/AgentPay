import express from 'express';
import { buyerAgent } from '../agents/buyer_agent.js';
import { SpendTokenManager } from '../policies/spend_token.js';
import { PolicyEngine } from '../policies/policy_engine.js';
import { razorpayAdapter } from '../payments/razorpay_adapter.js';
import { catalogService } from '../commerce/catalog.js';
import { MERCHANTS } from '../commerce/merchants.js';
import { auditStore } from '../database/audit_store.js';
import { runAllBenchmarks } from '../evaluation/run_benchmarks.js';
import { InputSanitizer } from '../agents/sanitizer.js';

export const router = express.Router();

// In-memory lightweight profile store
let userProfile = {
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  shippingAddress: 'Flat 402, Cyber Heights, Outer Ring Road, Bengaluru, Karnataka 560103',
  currency: 'INR',
  maxSingleTxnLimitINR: 15000,
  preferredLayout: '75% Compact',
  preferredOS: 'macOS & Windows'
};

// 1. Natural Language Shopping Intent
router.post('/agent/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message string is required' });
    }

    const result = await buyerAgent.processShoppingIntent(message);
    res.json(result);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1b. Propose Specific Product (e.g. user clicked "Select" / "Buy" on any candidate card)
router.post('/agent/propose-product', (req, res) => {
  try {
    const { productId, userBudgetINR, intentId: existingIntentId } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const product = catalogService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: `Product ${productId} not found` });
    }

    const intentId = existingIntentId || `intent_${crypto.randomUUID()}`;
    const quote = catalogService.createQuote(product.id, product.merchantId);

    const proposal = {
      intentId,
      quoteId: quote.quoteId,
      productId: product.id,
      merchantId: product.merchantId,
      merchantName: product.merchantName,
      productTitle: product.title,
      priceINR: product.priceINR,
      pricePaise: product.pricePaise,
      currency: 'INR',
      userBudgetINR: userBudgetINR || product.priceINR,
      reasoning: `User selected "${product.title}" by ${product.merchantName}. Backed by verified merchant with ${Math.round(product.merchantTrustScore * 100)}% trust rating and ${product.rating}★ user rating.`,
      scoreBreakdown: {
        featureScore: 100,
        ratingScore: Math.round((product.rating / 5) * 100),
        merchantTrustScore: Math.round(product.merchantTrustScore * 100),
        budgetScore: 100,
        inStock: product.inStock
      },
      validUntil: quote.validUntil,
      specs: product.specs,
      imageUrl: product.imageUrl
    };

    auditStore.logEvent({
      intentId,
      eventType: 'PROPOSAL_GENERATED',
      status: 'SUCCESS',
      details: proposal
    });

    res.json({
      success: true,
      intentId,
      proposal
    });
  } catch (error) {
    console.error('Propose product error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Grant Spend Authorization Token (AP2 Protocol)
router.post('/agent/authorize', (req, res) => {
  try {
    const { intentId, productId, merchantId, priceINR, pricePaise, maxBudgetINR } = req.body;

    if (!intentId || !productId || !merchantId || !priceINR) {
      return res.status(400).json({ error: 'Missing required authorization parameters' });
    }

    const userLimit = userProfile.maxSingleTxnLimitINR;
    const requestedBudget = maxBudgetINR || priceINR;
    const effectiveBudgetINR = Math.min(requestedBudget, userLimit);

    const token = SpendTokenManager.issueToken({
      intentId,
      productId,
      merchantId,
      priceINR,
      pricePaise: pricePaise || Math.round(priceINR * 100),
      maxBudgetINR: effectiveBudgetINR
    });

    auditStore.logEvent({
      intentId,
      eventType: 'AUTHORIZATION_GRANTED',
      status: 'SUCCESS',
      details: {
        tokenId: token.tokenId,
        productId,
        merchantId,
        authorizedAmountINR: priceINR,
        nonce: token.nonce,
        expiresAt: token.expiresAt
      }
    });

    res.json({
      success: true,
      spendToken: token
    });
  } catch (error) {
    console.error('Authorize endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Execute Purchase (Policy Invariant Check -> Razorpay Order Creation)
router.post('/agent/execute-purchase', async (req, res) => {
  try {
    const { spendToken, productId, merchantId, amountPaise } = req.body;

    if (!spendToken) {
      return res.status(400).json({
        error: 'Spend authorization token is required to execute a purchase.'
      });
    }

    // Step 1: Run Zero-Trust Deterministic Policy Check
    const policyResult = PolicyEngine.evaluateTransaction({
      spendToken,
      requestedProductId: productId || spendToken.productId,
      requestedMerchantId: merchantId || spendToken.merchantId,
      requestedAmountPaise: amountPaise || spendToken.authorizedAmountPaise
    });

    if (!policyResult.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Transaction rejected by Deterministic Policy Engine.',
        policyBlocked: true,
        violations: policyResult.violations,
        evaluatedPriceINR: policyResult.evaluatedPriceINR
      });
    }

    // Step 2: Policy Passed -> Create Razorpay Order
    const order = await razorpayAdapter.createOrder({
      amountPaise: spendToken.authorizedAmountPaise,
      currency: 'INR',
      receipt: `rcpt_${spendToken.intentId.slice(0, 12)}`,
      notes: {
        intent_id: spendToken.intentId,
        product_id: spendToken.productId,
        token_id: spendToken.tokenId
      },
      intentId: spendToken.intentId
    });

    res.json({
      success: true,
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      isSimulated: order._isSimulated,
      gatewayInfo: razorpayAdapter.getMode()
    });
  } catch (error) {
    console.error('Execute purchase error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Verify Razorpay Payment Signature
router.post('/agent/verify-payment', (req, res) => {
  try {
    const { orderId, paymentId, signature, intentId } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing orderId, paymentId, or signature' });
    }

    const verification = razorpayAdapter.verifyPayment({
      orderId,
      paymentId,
      signature,
      intentId
    });

    res.json({
      success: verification.isValid,
      ...verification
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Simulate Payment Execution (For test/demo workflows)
router.post('/agent/simulate-payment', async (req, res) => {
  try {
    const { orderId, shouldFail = false, failureReason, intentId } = req.body;
    const payment = await razorpayAdapter.simulatePayment({
      orderId,
      shouldFail,
      failureReason,
      intentId
    });

    res.json(payment);
  } catch (error) {
    console.error('Simulate payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Commerce Catalog & Merchants
router.get('/commerce/catalog', (req, res) => {
  const products = catalogService.products.map(p => catalogService.enrichProduct(p));
  res.json({
    merchants: Object.values(MERCHANTS),
    products
  });
});

// 6b. Single Product Detail
router.get('/commerce/product/:id', (req, res) => {
  const product = catalogService.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ product });
});

// 6c. Multi-Product Comparison Matrix
router.post('/commerce/compare', (req, res) => {
  try {
    const { productIds, userIntent } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
      return res.status(400).json({ error: 'productIds array with at least 2 IDs is required' });
    }

    const comparison = catalogService.compareProducts(productIds, userIntent);
    res.json(comparison);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 7. Dynamic Price Override (for simulating Price Surge failure demonstration)
router.post('/commerce/price-override', (req, res) => {
  const { productId, newPriceINR } = req.body;
  if (!productId || newPriceINR === undefined) {
    return res.status(400).json({ error: 'productId and newPriceINR are required' });
  }

  catalogService.setPriceOverride(productId, Number(newPriceINR));
  res.json({
    success: true,
    message: `Price for ${productId} updated to ₹${newPriceINR}`
  });
});

router.post('/commerce/clear-price-override', (req, res) => {
  const { productId } = req.body;
  catalogService.clearPriceOverride(productId);
  res.json({ success: true, message: `Price override cleared for ${productId}` });
});

// 8. Audit Trail Logs
router.get('/audit/logs', (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  const logs = auditStore.getAllLogs(limit);
  res.json({ logs });
});

// 9. Evaluation Benchmarks Endpoint
router.post('/eval/run', async (req, res) => {
  try {
    const summary = await runAllBenchmarks();
    res.json(summary);
  } catch (error) {
    console.error('Benchmark execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. System Status & Config info
router.get('/system/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.1.0',
    gateway: razorpayAdapter.getMode(),
    auditLogsCount: auditStore.logs.length,
    timestamp: new Date().toISOString()
  });
});

// 11. Lightweight User Profile
router.get('/user/profile', (req, res) => {
  res.json({ profile: userProfile });
});

router.post('/user/profile', (req, res) => {
  const updates = req.body;
  userProfile = {
    ...userProfile,
    ...updates
  };
  res.json({ success: true, profile: userProfile });
});

// 12. Security: Inspect content for prompt injection (used by Dev Lab injection demo)
//     SOURCE is always declared by the caller so the UI can report it accurately.

router.post('/security/inspect-injection', (req, res) => {
  try {
    const { content, source, merchantId } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content string is required' });
    }

    const inspection = InputSanitizer.inspectForInjection(content);

    auditStore.logEvent({
      intentId: `injection_probe_${Date.now()}`,
      eventType: 'INJECTION_INSPECTION',
      status: inspection.isMalicious ? 'VIOLATION_BLOCKED' : 'CLEAN',
      details: {
        source: source || 'unknown',
        merchantId: merchantId || null,
        isMalicious: inspection.isMalicious,
        detectedPattern: inspection.detectedPattern || null
      }
    });

    res.json({
      isMalicious: inspection.isMalicious,
      source: source || 'unknown',
      merchantId: merchantId || null,
      detectedPattern: inspection.detectedPattern || null,
      reason: inspection.reason || null
    });
  } catch (error) {
    console.error('Injection inspection error:', error);
    res.status(500).json({ error: error.message });
  }
});

