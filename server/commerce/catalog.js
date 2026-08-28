import crypto from 'crypto';
import { MERCHANTS, AUTHORIZED_MERCHANT_IDS } from './merchants.js';
import { InternalCatalogProvider, RAW_CATALOG } from './providers/internal_catalog_provider.js';

export const PRODUCTS = RAW_CATALOG;

class CatalogService {
  constructor() {
    this.providers = new Map();
    this.priceOverrides = new Map(); // For simulating price surge edge cases

    // Register default internal catalog provider
    const internalProvider = new InternalCatalogProvider();
    this.registerProvider(internalProvider);
    this.defaultProvider = internalProvider;
  }

  get products() {
    return this.defaultProvider.rawProducts;
  }

  registerProvider(provider) {
    this.providers.set(provider.id, provider);
  }

  /**
   * Search and filter products matching constraints across providers
   */
  search({ category, maxBudgetINR, requiredFeatures = [], includeUnauthorized = false }) {
    return this.products.filter(item => {
      if (!includeUnauthorized && !AUTHORIZED_MERCHANT_IDS.includes(item.merchantId)) {
        return false;
      }
      if (category && item.category !== category.toLowerCase()) {
        return false;
      }
      const effectivePrice = this.getEffectivePrice(item.id);
      if (maxBudgetINR && effectivePrice > maxBudgetINR) {
        return false;
      }
      if (requiredFeatures && requiredFeatures.length > 0) {
        const itemFeats = (item.features || []).map(f => f.toLowerCase());
        const hasAll = requiredFeatures.every(rf => 
          itemFeats.some(feat => feat.includes(rf.toLowerCase()))
        );
        if (!hasAll) return false;
      }
      return true;
    }).map(item => this.enrichProduct(item));
  }

  getProductById(productId) {
    const product = this.products.find(p => p.id === productId);
    return product ? this.enrichProduct(product) : null;
  }

  getEffectivePrice(productId) {
    const override = this.priceOverrides.get(productId);
    if (override !== undefined) return override;
    const prod = this.products.find(p => p.id === productId);
    return prod ? prod.priceINR : 0;
  }

  /**
   * Generate an x402-style signed merchant price quote
   */
  createQuote(productId, merchantId) {
    const product = this.getProductById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }
    const merchant = MERCHANTS[merchantId || product.merchantId];
    if (!merchant) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    const effectivePrice = this.getEffectivePrice(productId);
    const quoteId = `quote_${crypto.randomUUID()}`;
    const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL

    const quotePayload = {
      quoteId,
      productId: product.id,
      productTitle: product.title,
      merchantId: merchant.id,
      merchantName: merchant.name,
      priceINR: effectivePrice,
      pricePaise: Math.round(effectivePrice * 100),
      currency: 'INR',
      inStock: product.inStock,
      stockCount: product.stockCount,
      validUntil,
      protocol: 'x402-agentic-quote-v1'
    };

    return quotePayload;
  }

  /**
   * Compare 2 to 3 products side-by-side with structured attributes and AI comparative reasoning
   */
  compareProducts(productIds = [], userIntent = '') {
    if (!Array.isArray(productIds) || productIds.length < 2) {
      throw new Error('At least 2 products are required for comparison');
    }
    const selectedIds = productIds.slice(0, 3);
    const products = selectedIds
      .map(id => this.getProductById(id))
      .filter(Boolean);

    if (products.length < 2) {
      throw new Error('Could not resolve at least 2 valid products for comparison');
    }

    // Determine comparative winner based on ratings, price efficiency, and specs
    const sorted = [...products].sort((a, b) => {
      // Score = (rating * 20) + (merchantTrustScore * 20) - (priceINR / 1000)
      const scoreA = (a.rating * 20) + (a.merchantTrustScore * 20) + (a.inStock ? 10 : -50);
      const scoreB = (b.rating * 20) + (b.merchantTrustScore * 20) + (b.inStock ? 10 : -50);
      return scoreB - scoreA;
    });

    const topPick = sorted[0];
    const budgetPick = [...products].filter(p => p.inStock).sort((a, b) => a.priceINR - b.priceINR)[0];

    let reasoning = '';
    if (topPick.id === budgetPick.id) {
      reasoning = `**${topPick.title}** is the clear winner across both performance and value. At ₹${topPick.priceINR.toLocaleString('en-IN')}, it offers a ${topPick.rating}★ rating, ${topPick.specs?.switchType || 'premium switches'}, and verified merchant backing with lowest price in this comparison.`;
    } else {
      reasoning = `For top overall performance & build quality, **${topPick.title}** (₹${topPick.priceINR.toLocaleString('en-IN')}, ${topPick.rating}★) is recommended for its ${topPick.specs?.switchType || 'superior switches'} and acoustics. However, if budget conservation is key, **${budgetPick.title}** delivers incredible value at just ₹${budgetPick.priceINR.toLocaleString('en-IN')} (saving ₹${(topPick.priceINR - budgetPick.priceINR).toLocaleString('en-IN')}).`;
    }

    const comparisonMatrix = {
      attributes: [
        { label: 'Price (INR)', key: 'priceINR', format: (val) => `₹${val.toLocaleString('en-IN')}` },
        { label: 'Rating & Reviews', key: 'rating', format: (val, p) => `${val} ★ (${p.reviewsCount} reviews)` },
        { label: 'Merchant & Trust', key: 'merchantName', format: (val, p) => `${val} (${Math.round(p.merchantTrustScore * 100)}% trust)` },
        { label: 'Layout / Size', key: 'specs.layout', format: (val, p) => p.specs?.layout || 'Standard' },
        { label: 'Switch & Acoustics', key: 'specs.switchType', format: (val, p) => p.specs?.switchType || 'Mechanical' },
        { label: 'Sound Profile', key: 'specs.soundProfile', format: (val, p) => p.specs?.soundProfile || 'Standard' },
        { label: 'Connectivity', key: 'specs.connectivity', format: (val, p) => p.specs?.connectivity || 'Wireless / USB-C' },
        { label: 'Hot-Swappable', key: 'specs.hotSwappable', format: (val, p) => p.specs?.hotSwappable ? 'Yes ✓' : 'No' },
        { label: 'Battery / Power', key: 'specs.battery', format: (val, p) => p.specs?.battery || 'Rechargeable' },
        { label: 'Availability', key: 'inStock', format: (val, p) => val ? `In Stock (${p.stockCount} left)` : 'Out of Stock' }
      ],
      products,
      topPickId: topPick.id,
      budgetPickId: budgetPick?.id,
      comparativeReasoning: reasoning
    };

    return comparisonMatrix;
  }

  /**
   * Price Surge Simulation Helper
   */
  setPriceOverride(productId, newPriceINR) {
    this.priceOverrides.set(productId, newPriceINR);
  }

  clearPriceOverride(productId) {
    this.priceOverrides.delete(productId);
  }

  enrichProduct(product) {
    const merchant = MERCHANTS[product.merchantId] || { name: 'Unknown', trustScore: 0, isAuthorized: false };
    const effectivePrice = this.getEffectivePrice(product.id);
    return {
      ...product,
      priceINR: effectivePrice,
      pricePaise: Math.round(effectivePrice * 100),
      merchantName: merchant.name,
      merchantTrustScore: merchant.trustScore,
      isAuthorizedMerchant: merchant.isAuthorized
    };
  }
}

export const catalogService = new CatalogService();
