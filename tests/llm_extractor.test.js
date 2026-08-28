import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiIntentExtractor, IntentConstraintSchema } from '../server/agents/gemini_extractor.js';
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
  // Instance without API key
  const unconfiguredExtractor = new GeminiIntentExtractor('');
  assert.equal(unconfiguredExtractor.isConfigured(), false);

  // BuyerAgent should fallback seamlessly
  const extractionResult = await buyerAgent.extractConstraints('Find me a wireless mechanical keyboard under ₹7,500');
  
  assert.equal(extractionResult.isMalicious, false);
  assert.equal(extractionResult.constraints.category, 'keyboard');
  assert.equal(extractionResult.constraints.maxBudgetINR, 7500);
  assert.ok(extractionResult.constraints.requiredFeatures.includes('wireless'));
  assert.ok(extractionResult.constraints.requiredFeatures.includes('mechanical'));
  assert.equal(extractionResult.constraints.extractionSource, 'deterministic_rule_engine');
});
