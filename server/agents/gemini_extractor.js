import { z } from 'zod';
import { config } from '../config.js';
import { SYSTEM_PROMPTS } from './prompts.js';

// Strict Zod schema for validating untrusted LLM outputs
export const IntentConstraintSchema = z.object({
  intentType: z.enum(['commerce', 'conversational', 'ambiguous']).default('commerce'),
  conversationalReply: z.string().nullable().optional(),
  clarificationPrompt: z.string().nullable().optional(),
  category: z.string().nullable().default('keyboard'),
  maxBudgetINR: z.number().positive().nullable().default(null),
  budgetSpecified: z.boolean().default(false),
  currency: z.literal('INR').default('INR'),
  requiredFeatures: z.array(z.string()).default([]),
  useCase: z.string().nullable().optional(),
  originalQuery: z.string().optional()
});

export class GeminiIntentExtractor {
  constructor(apiKey = config.llm.geminiApiKey) {
    this.apiKey = apiKey;
    this.modelName = 'gemini-3.6-flash';
  }

  /**
   * Check if Gemini API is configured
   */
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.apiKey.includes('placeholder'));
  }

  /**
   * Validate and normalize raw object from LLM
   */
  validateLlmOutput(rawJson, originalQuery = '') {
    const candidate = {
      ...rawJson,
      originalQuery,
      currency: 'INR'
    };

    // Ensure valid intentType
    if (!['commerce', 'conversational', 'ambiguous'].includes(candidate.intentType)) {
      candidate.intentType = 'commerce';
    }

    // Budget normalization
    if (!candidate.budgetSpecified || candidate.maxBudgetINR === null || candidate.maxBudgetINR === undefined || candidate.maxBudgetINR <= 0) {
      candidate.maxBudgetINR = null;
      candidate.budgetSpecified = false;
    } else {
      candidate.maxBudgetINR = Number(candidate.maxBudgetINR);
      candidate.budgetSpecified = true;
    }

    if (!Array.isArray(candidate.requiredFeatures)) {
      candidate.requiredFeatures = [];
    }

    const parseResult = IntentConstraintSchema.safeParse(candidate);
    if (!parseResult.success) {
      throw new Error(`LLM output failed schema validation: ${parseResult.error.message}`);
    }

    return parseResult.data;
  }

  /**
   * Call Gemini Free Tier API with strict JSON schema
   */
  async extractIntent(sanitizedQuery) {
    if (!this.isConfigured()) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemInstruction = SYSTEM_PROMPTS.intentExtraction;
    const prompt = `Classify intent and extract shopping constraints for the following user request:
<USER_REQUEST>
${sanitizedQuery}
</USER_REQUEST>`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s — free tier can be slow

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${prompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (status ${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const contentText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!contentText) {
        throw new Error('Gemini API returned an empty response');
      }

      const rawJson = JSON.parse(contentText);
      return this.validateLlmOutput(rawJson, sanitizedQuery);
    } catch (err) {
      clearTimeout(timeoutId);
      // Translate AbortError into a human-readable message (never expose key)
      if (err.name === 'AbortError' || err.message === 'This operation was aborted') {
        throw new Error('Gemini API request timed out after 30s');
      }
      throw err;
    }
  }
}

export const geminiExtractor = new GeminiIntentExtractor();
