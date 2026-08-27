import express from 'express';
import { buyerAgent } from '../agents/buyer_agent.js';
import { SpendTokenManager } from '../policies/spend_token.js';
import { PolicyEngine } from '../policies/policy_engine.js';
import { razorpayAdapter } from '../payments/razorpay_adapter.js';
import { catalogService } from '../commerce/catalog.js';
import { MERCHANTS } from '../commerce/merchants.js';
import { auditStore } from '../database/audit_store.js';
import { runAllBenchmarks } from '../evaluation/run_benchmarks.js';

export const router = express.Router();

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

// 2. Grant Spend Authorization Token (AP2 Protocol)
router.post('/agent/authorize', (req, res) => {
  try {
    const { intentId, productId, merchantId, priceINR, pricePaise, maxBudgetINR } = req.body;

    if (!intentId || !productId || !merchantId || !priceINR) {
      return res.status(400).json({ error: 'Missing required authorization parameters' });
    }

    const token = SpendTokenManager.issueToken({
      intentId,
      productId,
      merchantId,
      priceINR,
      pricePaise: pricePaise || Math.round(priceINR * 100),
      maxBudgetINR: maxBudgetINR || priceINR
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
    version: '1.0.0',
    gateway: razorpayAdapter.getMode(),
    auditLogsCount: auditStore.logs.length,
    timestamp: new Date().toISOString()
  });
});

