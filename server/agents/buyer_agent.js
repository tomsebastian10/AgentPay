import crypto from 'crypto';
import { InputSanitizer } from './sanitizer.js';
import { geminiExtractor } from './gemini_extractor.js';
import { catalogService } from '../commerce/catalog.js';
import { auditStore } from '../database/audit_store.js';

export class BuyerAgent {
  /**
   * Deterministic rule-based intent and constraint extractor (robust offline fallback)
   */
  extractConstraintsDeterministic(sanitizedInput) {
    const trimmed = sanitizedInput.trim();
    const lower = trimmed.toLowerCase();

    // 1. Check for pure conversational greetings & general help
    const isConversationalGreeting = /^(hi|hello|hey|hola|namaste|greetings|howdy|good\s+(morning|afternoon|evening)|yo)\b/i.test(trimmed) &&
      !/(keyboard|mouse|headphone|audio|monitor|laptop|webcam|buy|price|under|rs|inr|₹|specs)/i.test(trimmed);
    const isGeneralHelp = /^(what\s+can\s+you\s+do\??|help|what\s+is\s+agentpay\??|who\s+are\s+you\??|thanks|thank\s+you|how\s+does\s+this\s+work\??)\b/i.test(trimmed);

    if (isConversationalGreeting || isGeneralHelp) {
      return {
        intentType: 'conversational',
        conversationalReply: "Hello! I'm AgentPay, your autonomous AI commerce assistant. I can help you find products, compare specifications, score verified merchant offers, and prepare bounded purchase proposals with zero-trust payment safeguards. Try asking: *\"Find me a quiet wireless mechanical keyboard under ₹8,000\"* or *\"Show me Sony ANC headphones for travel\"*.",
        clarificationPrompt: null,
        category: null,
        maxBudgetINR: null,
        budgetSpecified: false,
        currency: 'INR',
        requiredFeatures: [],
        originalQuery: sanitizedInput,
        extractionSource: 'deterministic_rule_engine'
      };
    }

    // 2. Category detection across available catalog categories
    let category = null;
    if (/keyboard|keychron|switch|gateron|tkl|keycap|keeb/i.test(sanitizedInput)) category = 'keyboard';
    else if (/mouse|mice|trackball|scroll/i.test(sanitizedInput)) category = 'mouse';
    else if (/headphone|headset|earphone|audio|earbuds|buds|anc/i.test(sanitizedInput)) category = 'headphones';
    else if (/monitor|display|screen|ultrawide|qhd|4k/i.test(sanitizedInput)) category = 'monitor';
    else if (/laptop|notebook|macbook|xps|ultrabook/i.test(sanitizedInput)) category = 'laptop';
    else if (/webcam|camera/i.test(sanitizedInput)) category = 'webcam';

    // 3. Extract budget in INR if explicitly specified by user
    // CRITICAL: If no budget is specified, keep maxBudgetINR as null (do NOT impose artificial default)
    let maxBudgetINR = null;
    let budgetSpecified = false;
    const budgetMatch = sanitizedInput.match(/(?:under|below|max|budget|within|<=?|around|max\s*of|upto|up\s*to|₹|\brs\.?)\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh)?/i) ||
                        sanitizedInput.match(/([\d,]+)\s*(?:inr|rs|rupees)/i);

    if (budgetMatch) {
      let num = parseFloat(budgetMatch[1].replace(/,/g, ''));
      if (budgetMatch[2]?.toLowerCase() === 'k') num *= 1000;
      if (!isNaN(num) && num > 0) {
        maxBudgetINR = num;
        budgetSpecified = true;
      }
    }

    // 4. Extract required and preferred features from natural language
    const requiredFeatures = [];
    if (/wireless|bluetooth|2\.4\s*ghz|cordless|tri-mode/i.test(sanitizedInput)) requiredFeatures.push('wireless');
    if (/mechanical|mechanic|switch/i.test(sanitizedInput)) requiredFeatures.push('mechanical');
    if (/rgb|backlit|lighting|illumination/i.test(sanitizedInput)) requiredFeatures.push('rgb-backlit');
    if (/hot[\s-]?swap/i.test(sanitizedInput)) requiredFeatures.push('hot-swappable');
    if (/compact|75%|65%|tkl|tenkeyless|mini|portable|small|space-saving/i.test(sanitizedInput)) requiredFeatures.push('compact');
    if (/mac|macos|apple/i.test(sanitizedInput)) requiredFeatures.push('mac-windows');
    if (/quiet|silent|not\s*too\s*loud|not\s*loud|noiseless|whisper|sound-damp/i.test(sanitizedInput)) requiredFeatures.push('quiet');
    if (/coding|programming|developer|programmer|software|code/i.test(sanitizedInput)) requiredFeatures.push('coding');
    if (/anc|noise\s*cancel/i.test(sanitizedInput)) requiredFeatures.push('active-noise-cancellation');
    if (/4k|uhd/i.test(sanitizedInput)) requiredFeatures.push('4k');
    if (/ergo|ergonomic/i.test(sanitizedInput)) requiredFeatures.push('ergonomic');

    // 5. Check for ambiguous / vague requests where category cannot be determined
    const isVagueRequest = !category && (
      /(something|recommend|suggest|show\s+me|find|gear|setup|deal|best)/i.test(sanitizedInput) ||
      /(for\s+work|for\s+office|for\s+college|for\s+school|for\s+gaming|for\s+programming)/i.test(sanitizedInput)
    );

    if (isVagueRequest) {
      return {
        intentType: 'ambiguous',
        conversationalReply: null,
        clarificationPrompt: "I'd love to help you find the right gear! Could you clarify what product category you're looking for? (e.g. mechanical keyboards, wireless mice, ANC headphones, 4K monitors, or laptops)",
        category: null,
        maxBudgetINR,
        budgetSpecified,
        currency: 'INR',
        requiredFeatures,
        originalQuery: sanitizedInput,
        extractionSource: 'deterministic_rule_engine'
      };
    }

    // Default to 'keyboard' if category is still null on a commerce query
    if (!category) {
      category = 'keyboard';
    }

    return {
      intentType: 'commerce',
      conversationalReply: null,
      clarificationPrompt: null,
      category,
      maxBudgetINR,
      budgetSpecified,
      currency: 'INR',
      requiredFeatures,
      originalQuery: sanitizedInput,
      extractionSource: 'deterministic_rule_engine'
    };
  }

  /**
   * Extract structured constraints from Natural Language intent.
   * Leverages Google Gemini free tier with structured JSON output,
   * with automatic fallback to deterministic rule engine.
   */
  async extractConstraints(userInput) {
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

    // Try Gemini LLM while it remains available in this server process
    if (geminiExtractor.isAvailable()) {
      try {
        const llmConstraints = await geminiExtractor.extractIntent(sanitizedInput);
        return {
          isMalicious: false,
          constraints: {
            ...llmConstraints,
            extractionSource: 'gemini_llm'
          }
        };
      } catch (err) {
        if (err.message === 'Gemini quota exhausted') {
          console.warn('Gemini quota exhausted; using offline fallback.');
        } else {
          console.warn(`Gemini LLM extraction warning (${err.message}). Falling back to deterministic extractor.`);
        }
      }
    }

    // Fallback: Deterministic rule-based extraction
    const deterministicConstraints = this.extractConstraintsDeterministic(sanitizedInput);
    return {
      isMalicious: false,
      constraints: deterministicConstraints
    };
  }

  /**
   * Score and rank candidate products
   */
  scoreProducts(products, constraints) {
    const hasBudget = constraints.maxBudgetINR !== null && constraints.maxBudgetINR !== undefined;

    return products.map(product => {
      const sanitized = InputSanitizer.sanitizeProductData(product);
      const productFeats = (product.features || []).map(f => f.toLowerCase());
      const productDesc = (product.description || '').toLowerCase();
      const productSpecs = Object.values(product.specs || {}).map(v => String(v).toLowerCase()).join(' ');

      // 1. Feature Match Score (0.0 to 1.0)
      let featureScore = 1.0;
      if (constraints.requiredFeatures && constraints.requiredFeatures.length > 0) {
        const matched = constraints.requiredFeatures.filter(rf => {
          const req = rf.toLowerCase();
          if (req === 'quiet') {
            return productFeats.some(pf => pf.includes('quiet') || pf.includes('silent')) ||
                   productSpecs.includes('quiet') || productSpecs.includes('silent') ||
                   productDesc.includes('quiet') || productDesc.includes('silent');
          }
          if (req === 'coding') {
            return productFeats.some(pf => pf.includes('coding') || pf.includes('mac-windows') || pf.includes('qmk-via')) ||
                   productDesc.includes('coding') || productDesc.includes('program');
          }
          if (req === 'compact') {
            return productFeats.some(pf => pf.includes('compact') || pf.includes('65%') || pf.includes('75%') || pf.includes('tkl')) ||
                   productSpecs.includes('compact') || productSpecs.includes('75%') || productSpecs.includes('65%');
          }
          return productFeats.some(pf => pf.includes(req)) || productSpecs.includes(req) || productDesc.includes(req);
        });
        featureScore = matched.length / constraints.requiredFeatures.length;
      }

      // 2. Rating Score (0.0 to 1.0)
      const ratingScore = Math.min(1.0, (product.rating || 4.0) / 5.0);

      // 3. Merchant Trust Score (0.0 to 1.0)
      const merchantTrustScore = product.merchantTrustScore || 0.5;

      // 4. Budget Efficiency Score (0.0 to 1.0)
      let budgetScore = 0.85;
      if (hasBudget) {
        if (product.priceINR <= constraints.maxBudgetINR) {
          const ratio = product.priceINR / constraints.maxBudgetINR;
          budgetScore = 0.6 + (0.4 * ratio);
        } else {
          budgetScore = 0.0;
        }
      } else {
        // When no budget is set, normalize across catalog price range for balanced value
        budgetScore = 0.75 + (0.25 * (1 - Math.min(1, product.priceINR / 12000)));
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
    const extractionResult = await this.extractConstraints(userInput);
    
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

    // Handle 1: Conversational Intent (Greetings, help, chit-chat)
    if (constraints.intentType === 'conversational') {
      auditStore.logEvent({
        intentId,
        eventType: 'CONVERSATIONAL_INTENT',
        status: 'SUCCESS',
        details: { query: userInput, reply: constraints.conversationalReply, source: constraints.extractionSource }
      });

      return {
        intentId,
        success: true,
        isConversational: true,
        message: constraints.conversationalReply,
        constraints,
        recommendation: null,
        candidates: []
      };
    }

    // Handle 2: Ambiguous Commerce Intent (Needs category clarification)
    if (constraints.intentType === 'ambiguous') {
      auditStore.logEvent({
        intentId,
        eventType: 'AMBIGUOUS_INTENT_CLARIFICATION',
        status: 'SUCCESS',
        details: { query: userInput, prompt: constraints.clarificationPrompt, source: constraints.extractionSource }
      });

      return {
        intentId,
        success: true,
        isAmbiguous: true,
        message: constraints.clarificationPrompt,
        constraints,
        recommendation: null,
        candidates: []
      };
    }

    // Handle 3: Specific Commerce Intent -> Product Discovery & Scoring
    const hasBudget = constraints.maxBudgetINR !== null && constraints.maxBudgetINR !== undefined;

    auditStore.logEvent({
      intentId,
      eventType: 'INTENT_EXTRACTED',
      status: 'SUCCESS',
      details: constraints
    });

    // Step 2: Product Discovery across authorized merchant catalogs
    const searchBudget = hasBudget ? constraints.maxBudgetINR * 1.2 : null;
    const candidateProducts = catalogService.search({
      category: constraints.category || 'keyboard',
      maxBudgetINR: searchBudget,
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
      const budgetMsg = hasBudget ? ` under ₹${constraints.maxBudgetINR.toLocaleString('en-IN')}` : '';
      return {
        intentId,
        success: false,
        message: `No products found matching "${constraints.category}"${budgetMsg}.`,
        constraints,
        recommendation: null,
        candidates: []
      };
    }

    // Step 3: Multi-attribute scoring & selection
    const scoredCandidates = this.scoreProducts(candidateProducts, constraints);
    
    // Find best candidate
    const bestCandidate = hasBudget
      ? scoredCandidates.find(c => c.product.inStock && c.product.priceINR <= constraints.maxBudgetINR)
      : scoredCandidates.find(c => c.product.inStock);

    if (!bestCandidate) {
      const budgetMsg = hasBudget ? ` under ₹${constraints.maxBudgetINR.toLocaleString('en-IN')}` : '';
      return {
        intentId,
        success: false,
        message: `Found options, but none currently in-stock satisfy all hard constraints${budgetMsg}.`,
        constraints,
        recommendation: null,
        candidates: scoredCandidates
      };
    }

    // Step 4: Generate time-limited merchant quote (x402 protocol)
    const quote = catalogService.createQuote(bestCandidate.product.id, bestCandidate.product.merchantId);

    // Step 5: Build human-readable reasoning and proposal
    let reasoning = '';
    if (hasBudget) {
      const budgetDiff = constraints.maxBudgetINR - bestCandidate.product.priceINR;
      const budgetClause = budgetDiff >= 0 
        ? `(₹${budgetDiff.toLocaleString('en-IN')} under your ₹${constraints.maxBudgetINR.toLocaleString('en-IN')} budget)`
        : `within your ₹${constraints.maxBudgetINR.toLocaleString('en-IN')} budget`;
      reasoning = `Selected "${bestCandidate.product.title}" from ${bestCandidate.product.merchantName} at ₹${bestCandidate.product.priceINR.toLocaleString('en-IN')} ${budgetClause}. It has a ${bestCandidate.product.rating}★ rating (${bestCandidate.product.reviewsCount} reviews), includes requested features (${bestCandidate.product.features.slice(0, 4).join(', ')}), and is backed by a verified merchant with a ${(bestCandidate.product.merchantTrustScore * 100)}% trust rating.`;
    } else {
      reasoning = `Selected "${bestCandidate.product.title}" from ${bestCandidate.product.merchantName} at ₹${bestCandidate.product.priceINR.toLocaleString('en-IN')} as the top overall match for your requirements. It features ${bestCandidate.product.specs?.switchType || 'smooth switches'}, ${bestCandidate.product.specs?.layout || 'compact layout'}, a ${bestCandidate.product.rating}★ rating (${bestCandidate.product.reviewsCount} reviews), and ${(bestCandidate.product.merchantTrustScore * 100)}% merchant trust score.`;
    }

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
      userBudgetINR: hasBudget ? constraints.maxBudgetINR : bestCandidate.product.priceINR,
      reasoning,
      scoreBreakdown: bestCandidate.breakdown,
      validUntil: quote.validUntil,
      specs: bestCandidate.product.specs,
      imageUrl: bestCandidate.product.imageUrl
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
        pricePaise: c.product.pricePaise,
        rating: c.product.rating,
        reviewsCount: c.product.reviewsCount,
        inStock: c.product.inStock,
        stockCount: c.product.stockCount,
        features: c.product.features,
        specs: c.product.specs,
        description: c.product.description,
        imageUrl: c.product.imageUrl,
        totalScore: c.totalScore,
        breakdown: c.breakdown,
        isSelected: c.product.id === bestCandidate.product.id
      }))
    };
  }
}

export const buyerAgent = new BuyerAgent();
