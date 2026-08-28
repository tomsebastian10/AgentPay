import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerAgent } from '../server/agents/buyer_agent.js';
import { catalogService } from '../server/commerce/catalog.js';

test('Commerce Agent: should correctly extract constraints from NL request', async () => {
  const query = 'Find me a wireless mechanical keyboard under ₹8,000 and buy the best one';
  const result = await buyerAgent.extractConstraints(query);

  assert.equal(result.isMalicious, false);
  assert.equal(result.constraints.category, 'keyboard');
  assert.equal(result.constraints.maxBudgetINR, 8000);
  assert.ok(result.constraints.requiredFeatures.includes('wireless'));
  assert.ok(result.constraints.requiredFeatures.includes('mechanical'));
});

test('Commerce Agent: should handle conversational intent with NO artificial default budget', async () => {
  const query = 'I need a good wireless mechanical keyboard for coding, something compact and quiet';
  const result = await buyerAgent.processShoppingIntent(query);

  assert.equal(result.success, true);
  assert.equal(result.constraints.maxBudgetINR, null, 'Budget should be null when unspecified');
  assert.ok(result.constraints.requiredFeatures.includes('wireless'));
  assert.ok(result.constraints.requiredFeatures.includes('mechanical'));
  assert.ok(result.constraints.requiredFeatures.includes('coding'));
  assert.ok(result.constraints.requiredFeatures.includes('compact'));
  assert.ok(result.constraints.requiredFeatures.includes('quiet'));
  assert.ok(result.proposal);
  assert.ok(result.comparisonCandidates.length >= 3);
});

test('Commerce Agent: should select best in-budget candidate with complete justification', async () => {
  const query = 'Find me a wireless mechanical keyboard under ₹8,000';
  const result = await buyerAgent.processShoppingIntent(query);

  assert.equal(result.success, true);
  assert.ok(result.proposal);
  assert.ok(result.proposal.priceINR <= 8000);
  assert.ok(result.proposal.reasoning.length > 20);
  assert.equal(result.proposal.currency, 'INR');
  assert.ok(result.comparisonCandidates.length >= 2);
});

test('Commerce Agent: should handle no matching products within tiny budget', async () => {
  const query = 'Find me a mechanical keyboard under ₹500';
  const result = await buyerAgent.processShoppingIntent(query);

  assert.equal(result.success, false);
  assert.equal(result.proposal, undefined);
  assert.match(result.message, /No products found/i);
});

test('Commerce Catalog: should compare 2 to 3 products and generate comparative reasoning', () => {
  const comparison = catalogService.compareProducts(['prod_k2_v2', 'prod_rkg68', 'prod_k3_ultra']);

  assert.equal(comparison.products.length, 3);
  assert.ok(comparison.attributes.length >= 8);
  assert.ok(comparison.comparativeReasoning.length > 20);
  assert.ok(comparison.topPickId);
  assert.ok(comparison.budgetPickId);
});
