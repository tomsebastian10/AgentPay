import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerAgent } from '../server/agents/buyer_agent.js';

test('Intent Classification: "hi" should return conversational response without triggering product discovery', async () => {
  const result = await buyerAgent.processShoppingIntent('hi');

  assert.equal(result.success, true);
  assert.equal(result.isConversational, true);
  assert.equal(result.proposal, undefined);
  assert.equal(result.recommendation, null);
  assert.equal(result.candidates.length, 0);
  assert.match(result.message, /AgentPay/i);
});

test('Intent Classification: "hello" should return conversational guidance without recommending products', async () => {
  const result = await buyerAgent.processShoppingIntent('hello');

  assert.equal(result.success, true);
  assert.equal(result.isConversational, true);
  assert.equal(result.proposal, undefined);
  assert.match(result.message, /autonomous AI commerce/i);
});

test('Intent Classification: "what can you do?" should return general help response', async () => {
  const result = await buyerAgent.processShoppingIntent('what can you do?');

  assert.equal(result.success, true);
  assert.equal(result.isConversational, true);
  assert.equal(result.proposal, undefined);
  assert.match(result.message, /AgentPay/i);
});

test('Intent Classification: "find me a wireless keyboard" should proceed to commerce flow and return a proposal', async () => {
  const result = await buyerAgent.processShoppingIntent('find me a wireless keyboard');

  assert.equal(result.success, true);
  assert.equal(result.isConversational, undefined);
  assert.equal(result.isAmbiguous, undefined);
  assert.ok(result.proposal);
  assert.equal(result.constraints.category, 'keyboard');
  assert.equal(result.constraints.maxBudgetINR, null, 'Budget must be null when unspecified');
  assert.equal(result.constraints.budgetSpecified, false);
});

test('Intent Classification: "something good for work" should ask for category clarification (ambiguous flow)', async () => {
  const result = await buyerAgent.processShoppingIntent('something good for work');

  assert.equal(result.success, true);
  assert.equal(result.isAmbiguous, true);
  assert.equal(result.proposal, undefined);
  assert.match(result.message, /clarify what.*category/i);
});

test('Intent Classification: "I need something for college" should trigger clarification instead of guessing', async () => {
  const result = await buyerAgent.processShoppingIntent('I need something for college');

  assert.equal(result.success, true);
  assert.equal(result.isAmbiguous, true);
  assert.equal(result.proposal, undefined);
});
