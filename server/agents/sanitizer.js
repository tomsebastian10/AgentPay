/**
 * Adversarial Input Sanitizer & Prompt-Injection Guardrail
 */

const SUSPICIOUS_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /system\s+override/i,
  /you\s+are\s+now\s+(in\s+)?(developer|admin|bypass|sudo)\s+mode/i,
  /disregard\s+(the\s+)?(budget|policy|rules|limit)/i,
  /bypass\s+all\s+checks/i,
  /transfer\s+(funds|money)\s+immediately/i,
  /execute\s+payment\s+without\s+authorization/i,
  /<\/?system>/i,
  /\[system\s+directive\]/i
];

export class InputSanitizer {
  /**
   * Check whether input contains adversarial prompt injection
   */
  static inspectForInjection(text) {
    if (!text || typeof text !== 'string') return { isMalicious: false };
    
    for (const pattern of SUSPICIOUS_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          isMalicious: true,
          detectedPattern: pattern.toString(),
          reason: 'Adversarial prompt-injection attempt detected in input.'
        };
      }
    }

    return { isMalicious: false };
  }

  /**
   * Sanitize string by stripping unsafe delimiter characters and tags
   */
  static sanitizeString(input) {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // strip control chars
      .replace(/<[^>]*>?/gm, '') // strip HTML/XML tags
      .trim();
  }

  /**
   * Clean and isolate product descriptions from merchant catalogs
   */
  static sanitizeProductData(product) {
    return {
      id: this.sanitizeString(product.id),
      title: this.sanitizeString(product.title),
      description: this.sanitizeString(product.description),
      category: this.sanitizeString(product.category),
      priceINR: typeof product.priceINR === 'number' ? product.priceINR : 0,
      features: Array.isArray(product.features) ? product.features.map(f => this.sanitizeString(f)) : []
    };
  }
}
