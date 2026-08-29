import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiIntentExtractor, IntentConstraintSchema, geminiExtractor } from '../server/agents/gemini_extractor.js';
import { buyerAgent } from '../server/agents/buyer_agent.js';

test('LLM Extractor: should validate well-formed structured JSON from Gemini', () => {
  const extractor = new GeminiIntentExtractor('dummy_key');
  const rawLlmOutput = {
    category: 'keyboard',
    maxBudgetINR: 8000,
    budgetSpecified: true,
    currency: 'INR',
    requiredFeatures: ['wireless', 'mechanical', 'quiet'],
    useCase: 'programming'
  };

  const validated = extractor.validateLlmOutput(rawLlmOutput, 'Find wireless quiet mechanical keyboard under 8k');

  assert.equal(validated.category, 'keyboard');
  assert.equal(validated.maxBudgetINR, 8000);
  assert.equal(validated.budgetSpecified, true);
  assert.equal(validated.currency, 'INR');
  assert.deepEqual(validated.requiredFeatures, ['wireless', 'mechanical', 'quiet']);
});

test('LLM Extractor: should strictly enforce maxBudgetINR: null when no budget is specified', () => {
  const extractor = new GeminiIntentExtractor('dummy_key');
  const rawLlmOutputWithoutBudget = {
    category: 'keyboard',
    maxBudgetINR: null,
    budgetSpecified: false,
    currency: 'INR',
    requiredFeatures: ['wireless', 'compact']
  };

  const validated = extractor.validateLlmOutput(rawLlmOutputWithoutBudget, 'I need a good wireless compact keyboard for coding');

  assert.equal(validated.maxBudgetINR, null, 'Budget must be strictly null when unspecified');
  assert.equal(validated.budgetSpecified, false);
});

test('LLM Extractor: should neutralize and repair malformed/untrusted LLM output safely', () => {
  const extractor = new GeminiIntentExtractor('dummy_key');
  
  // Malformed raw output: missing array for features, invalid negative budget
  const malformedOutput = {
    category: 'headphones',
    maxBudgetINR: -500, // invalid negative
    budgetSpecified: true,
    requiredFeatures: null // malformed
  };

  const validated = extractor.validateLlmOutput(malformedOutput, 'Sony headphones');

  assert.equal(validated.category, 'headphones');
  assert.equal(validated.maxBudgetINR, null, 'Negative budget must be normalized to null');
  assert.equal(validated.budgetSpecified, false);
  assert.deepEqual(validated.requiredFeatures, []);
});

test('LLM Extractor: should gracefully fallback to deterministic rule extractor when API key is absent', async () => {
  // Verify that an unconfigured extractor correctly reports isConfigured() = false
  const unconfiguredExtractor = new GeminiIntentExtractor('');
  assert.equal(unconfiguredExtractor.isConfigured(), false);

  // Verify the deterministic fallback path produces correct, complete output.
  // We call extractConstraintsDeterministic directly because the global buyerAgent
  // singleton uses the real module-level geminiExtractor (which may be configured
  // via .env); the fallback path itself is what we need to assert here.
  const fallbackResult = buyerAgent.extractConstraintsDeterministic(
    'Find me a wireless mechanical keyboard under ₹7,500'
  );

  assert.equal(fallbackResult.category, 'keyboard');
  assert.equal(fallbackResult.maxBudgetINR, 7500);
  assert.ok(fallbackResult.requiredFeatures.includes('wireless'));
  assert.ok(fallbackResult.requiredFeatures.includes('mechanical'));
  assert.equal(fallbackResult.extractionSource, 'deterministic_rule_engine');
});

test('LLM Extractor: should translate AbortError into a clean timeout message', async () => {
  // Monkey-patch fetch on a local extractor instance to simulate an AbortError
  const extractor = new GeminiIntentExtractor('dummy_key_for_timeout_test');

  const abortError = new Error('This operation was aborted');
  abortError.name = 'AbortError';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw abortError; };

  try {
    await extractor.extractIntent('find me a keyboard');
    assert.fail('Expected extractIntent to throw');
  } catch (err) {
    assert.equal(
      err.message,
      'Gemini API request timed out after 30s',
      'AbortError must be translated to a clean timeout message'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM Extractor: should latch quota exhaustion and use offline fallback without another Gemini request', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = geminiExtractor.apiKey;
  const originalQuotaExhausted = geminiExtractor.quotaExhausted;
  let fetchCalls = 0;

  geminiExtractor.apiKey = 'dummy_key_for_quota_test';
  geminiExtractor.quotaExhausted = false;
  globalThis.fetch = async () => {
    fetchCalls++;
    return {
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } })
    };
  };

  try {
    const firstResult = await buyerAgent.extractConstraints(
      'Find me a wireless mechanical keyboard under Rs 7,500'
    );
    assert.equal(firstResult.constraints.extractionSource, 'deterministic_rule_engine');
    assert.equal(geminiExtractor.isAvailable(), false);

    const secondResult = await buyerAgent.extractConstraints(
      'Find me a wireless mechanical keyboard under Rs 7,500'
    );
    assert.equal(secondResult.constraints.extractionSource, 'deterministic_rule_engine');
    assert.equal(fetchCalls, 1, 'Quota latch must prevent subsequent Gemini network requests');
  } finally {
    globalThis.fetch = originalFetch;
    geminiExtractor.apiKey = originalApiKey;
    geminiExtractor.quotaExhausted = originalQuotaExhausted;
  }
});
