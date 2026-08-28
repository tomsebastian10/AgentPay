/**
 * Base Product Provider Interface
 * Standardizes product discovery across internal catalogs, merchant APIs, and marketplace adapters.
 */
export class BaseProductProvider {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  /**
   * Search for products matching criteria
   * @param {Object} query - { category, maxBudgetINR, requiredFeatures, queryText }
   * @returns {Promise<Array<Object>>} Normalized products
   */
  async search(query) {
    throw new Error('Method search() must be implemented by subclass');
  }

  /**
   * Fetch a single product by ID
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async getProductById(productId) {
    throw new Error('Method getProductById() must be implemented by subclass');
  }

  /**
   * Normalize raw item into AgentPay standard product schema
   */
  normalizeProduct(item) {
    return {
      id: item.id,
      merchantId: item.merchantId,
      merchantName: item.merchantName || 'Verified Merchant',
      merchantTrustScore: item.merchantTrustScore || 0.95,
      isAuthorizedMerchant: item.isAuthorizedMerchant !== false,
      title: item.title || item.name,
      category: item.category || 'keyboard',
      priceINR: item.priceINR || Math.round((item.pricePaise || 0) / 100),
      pricePaise: item.pricePaise || Math.round((item.priceINR || 0) * 100),
      currency: item.currency || 'INR',
      rating: item.rating || 4.5,
      reviewsCount: item.reviewsCount || 100,
      inStock: item.inStock !== false,
      stockCount: item.stockCount ?? 10,
      features: item.features || [],
      specs: item.specs || {},
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      productUrl: item.productUrl || '',
      providerId: this.id
    };
  }
}
