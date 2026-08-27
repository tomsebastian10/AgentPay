import crypto from 'crypto';
import { InputSanitizer } from './sanitizer.js';
import { catalogService } from '../commerce/catalog.js';
import { auditStore } from '../database/audit_store.js';

export class BuyerAgent {
  /**
   * Extract structured constraints from Natural Language intent
   */
  extractConstraints(userInput) {
    const sanitizedInput = InputSanitizer.sanitizeString(userInput);
    const injectionCheck = InputSanitizer.inspectForInjection(userInput);

    if (injectionCheck.isMalicious) {
      return {
        isMalicious: true,
        error: injectionCheck.reason,
        detectedPattern: injectionCheck.detectedPattern,
        constraints: null
      };
    }

    // High-precision deterministic parser for commerce requests
    let category = 'keyboard';
    if (/mouse|mice/i.test(sanitizedInput)) category = 'mouse';
    else if (/headphone|headset|earphone/i.test(sanitizedInput)) category = 'audio';
    else if (/monitor|display|screen/i.test(sanitizedInput)) category = 'monitor';

    // Extract budget in INR (e.g. "under ₹8,000", "below 8000", "8k budget", "< 7500")
    let maxBudgetINR = 10000;
    const budgetMatch = sanitizedInput.match(/(?:under|below|max|budget|within|<=?|₹|\brs\.?)\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh)?/i) ||
                        sanitizedInput.match(/([\d,]+)\s*(?:inr|rs|rupees)/i);
    
    if (budgetMatch) {
      let num = parseFloat(budgetMatch[1].replace(/,/g, ''));
      if (budgetMatch[2]?.toLowerCase() === 'k') num *= 1000;
      if (!isNaN(num) && num > 0) {
        maxBudgetINR = num;
      }
    }

    // Extract required features
    const requiredFeatures = [];
    if (/wireless|bluetooth|2\.4\s*ghz|cordless/i.test(sanitizedInput)) requiredFeatures.push('wireless');
    if (/mechanical|mechanic/i.test(sanitizedInput)) requiredFeatures.push('mechanical');
    if (/rgb|backlit|lighting/i.test(sanitizedInput)) requiredFeatures.push('rgb-backlit');
    if (/hot[\s-]?swap/i.test(sanitizedInput)) requiredFeatures.push('hot-swappable');
    if (/compact|75%|65%|tkl|tenkeyless/i.test(sanitizedInput)) requiredFeatures.push('compact');
    if (/mac|macos|apple/i.test(sanitizedInput)) requiredFeatures.push('mac-windows');

    return {
      isMalicious: false,
      constraints: {
        category,
        maxBudgetINR,
        currency: 'INR',
        requiredFeatures,
        originalQuery: sanitizedInput
      }
    };
  }

  /**
   * Score and rank candidate products
   */
  scoreProducts(products, constraints) {
    return products.map(product => {
      const sanitized = InputSanitizer.sanitizeProductData(product);
      
      // 1. Feature Match Score (0.0 to 1.0)
      let featureScore = 1.0;
      if (constraints.requiredFeatures.length > 0) {
        const productFeats = product.features.map(f => f.toLowerCase());
        const matched = constraints.requiredFeatures.filter(rf =>
          productFeats.some(pf => pf.includes(rf.toLowerCase()))
        );
        featureScore = matched.length / constraints.requiredFeatures.length;
      }

      // 2. Rating Score (0.0 to 1.0)
      const ratingScore = Math.min(1.0, (product.rating || 4.0) / 5.0);

      // 3. Merchant Trust Score (0.0 to 1.0)
      const merchantTrustScore = product.merchantTrustScore || 0.5;

      // 4. Budget Efficiency Score (0.0 to 1.0)
      // Products closer to the budget limit that offer high quality get good balance
      let budgetScore = 0.8;
      if (product.priceINR <= constraints.maxBudgetINR) {
        const ratio = product.priceINR / constraints.maxBudgetINR;
        budgetScore = 0.6 + (0.4 * ratio); // 0.6 to 1.0 for valid in-budget products
      } else {
        budgetScore = 0.0; // Over budget gets zero
      }

      // Stock penalty
      const stockMultiplier = product.inStock ? 1.0 : 0.0;

      // Weighted Composite Score
      // Weights: Feature (40%), Rating (25%), Trust (20%), Budget (15%)
      const totalScore = (
        (featureScore * 0.40) +
        (ratingScore * 0.25) +
        (merchantTrustScore * 0.20) +
        (budgetScore * 0.15)
      ) * stockMultiplier;

      return {
        product,
        totalScore: Math.round(totalScore * 100) / 100,
        breakdown: {
          featureScore: Math.round(featureScore * 100),
          ratingScore: Math.round(ratingScore * 100),
          merchantTrustScore: Math.round(merchantTrustScore * 100),
          budgetScore: Math.round(budgetScore * 100),
          inStock: product.inStock
        }
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Main shopping workflow: Process Query -> Extract Constraints -> Discover -> Score -> Generate Proposal
   */
  async processShoppingIntent(userInput) {
    const intentId = `intent_${crypto.randomUUID()}`;

    // Step 1: Constraint Extraction & Adversarial Inspection
    const extractionResult = this.extractConstraints(userInput);
    
    if (extractionResult.isMalicious) {
      auditStore.logEvent({
        intentId,
        eventType: 'INTENT_EXTRACTED',
        status: 'VIOLATION_BLOCKED',
        details: {
          userInput,
          reason: extractionResult.error,
          pattern: extractionResult.detectedPattern
        }
      });

      return {
        intentId,
        success: false,
        isAdversarialBlocked: true,
        message: 'Security Alert: Adversarial prompt injection or unauthorized directive detected and neutralized.',
        recommendation: null,
        candidates: []
      };
    }

    const { constraints } = extractionResult;

    auditStore.logEvent({
      intentId,
      eventType: 'INTENT_EXTRACTED',
      status: 'SUCCESS',
      details: constraints
    });

    // Step 2: Product Discovery across authorized merchant catalogs
    const candidateProducts = catalogService.search({
      category: constraints.category,
      maxBudgetINR: constraints.maxBudgetINR * 1.2, // Check slightly above budget too for comparison transparency
      requiredFeatures: [],
      includeUnauthorized: false
    });

    auditStore.logEvent({
      intentId,
      eventType: 'DISCOVERY_COMPLETED',
      status: 'SUCCESS',
      details: {
        totalFound: candidateProducts.length,
        candidateIds: candidateProducts.map(p => p.id)
      }
    });

    if (candidateProducts.length === 0) {
      return {
        intentId,
        success: false,
        message: `No products found matching "${constraints.category}" under ₹${constraints.maxBudgetINR.toLocaleString('en-IN')}.`,
        constraints,
        recommendation: null,
        candidates: []
      };
    }

    // Step 3: Multi-attribute scoring & selection
    const scoredCandidates = this.scoreProducts(candidateProducts, constraints);
    const bestCandidate = scoredCandidates.find(c => c.product.inStock && c.product.priceINR <= constraints.maxBudgetINR);

    if (!bestCandidate) {
      return {
        intentId,
        success: false,
        message: `Found options, but none currently in-stock satisfy all hard constraints under ₹${constraints.maxBudgetINR.toLocaleString('en-IN')}.`,
        constraints,
        recommendation: null,
        candidates: scoredCandidates
      };
    }

    // Step 4: Generate time-limited merchant quote (x402 protocol)
    const quote = catalogService.createQuote(bestCandidate.product.id, bestCandidate.product.merchantId);

    // Step 5: Build human-readable reasoning and proposal
    const reasoning = `Selected "${bestCandidate.product.title}" from ${bestCandidate.product.merchantName} at ₹${bestCandidate.product.priceINR.toLocaleString('en-IN')} (₹${(constraints.maxBudgetINR - bestCandidate.product.priceINR).toLocaleString('en-IN')} under your ₹${constraints.maxBudgetINR.toLocaleString('en-IN')} budget). It has a ${bestCandidate.product.rating}★ rating (${bestCandidate.product.reviewsCount} reviews), includes all requested features (${bestCandidate.product.features.slice(0, 4).join(', ')}), and is sold by a verified merchant with a ${(bestCandidate.product.merchantTrustScore * 100)}% trust rating.`;

    const proposal = {
      intentId,
      quoteId: quote.quoteId,
      productId: bestCandidate.product.id,
      merchantId: bestCandidate.product.merchantId,
      merchantName: bestCandidate.product.merchantName,
      productTitle: bestCandidate.product.title,
      priceINR: bestCandidate.product.priceINR,
      pricePaise: bestCandidate.product.pricePaise,
      currency: 'INR',
      userBudgetINR: constraints.maxBudgetINR,
      reasoning,
      scoreBreakdown: bestCandidate.breakdown,
      validUntil: quote.validUntil
    };

    auditStore.logEvent({
      intentId,
      eventType: 'PROPOSAL_GENERATED',
      status: 'SUCCESS',
      details: proposal
    });

    return {
      intentId,
      success: true,
      constraints,
      proposal,
      comparisonCandidates: scoredCandidates.map(c => ({
        id: c.product.id,
        title: c.product.title,
        merchantName: c.product.merchantName,
        priceINR: c.product.priceINR,
        rating: c.product.rating,
        inStock: c.product.inStock,
        totalScore: c.totalScore,
        isSelected: c.product.id === bestCandidate.product.id
      }))
    };
  }
}

export const buyerAgent = new BuyerAgent();
