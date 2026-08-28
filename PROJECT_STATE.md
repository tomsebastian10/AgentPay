# Project State

## Current Phase
STAGE 22 — Lightweight Intent Classification (Conversational, Ambiguous, Commerce) & AI Honesty Engine (Completed)

## Completed
- **STAGE 0 — Challenge Research:** Documented official track requirements in `docs/challenge-analysis.md`.
- **STAGE 1 — Technical Research:** Documented Razorpay Test Mode APIs (Orders, Checkout, Payments, HMAC verification, Webhooks) and Agentic protocols (MCP, AP2/ACP, x402) in `docs/technical-research.md`.
- **STAGE 2 & 3 — System Design & Architecture:** Detailed dual-engine modular monolith, Pydantic schemas, and security invariants in `docs/architecture.md`.
- **STAGE 4 — Repository Foundation:** Initialized Node.js ES Modules environment with Express, Razorpay SDK, Zod, and Cors.
- **STAGE 5 — AI Buyer Reasoning Engine:** Implemented `buyer_agent.js`, `sanitizer.js`, and `prompts.js` for constraint extraction, adversarial defense, candidate scoring, and reasoning.
- **STAGE 6 & 7 — Merchant Interface & Product Discovery:** Implemented `merchants.js` and `catalog.js` with x402 quotes, stock tracking, and multi-merchant search.
- **STAGE 8 — Checkout & Razorpay Test Mode:** Implemented `razorpay_adapter.js`, `mock_provider.js`, and `verifier.js` with HMAC-SHA256 constant-time signature verification.
- **STAGE 9 & 10 — Policy Engine, AP2 Tokens & Failure Handling:** Implemented `spend_token.js` and `policy_engine.js` with zero-trust validation (budget cap, price drift, merchant whitelist, anti-replay nonce, in-stock).
- **STAGE 11 — Audit Trail:** Implemented persistent `audit_store.js` recording all transaction steps immutably.
- **STAGE 12 — Evaluation Suite:** Implemented `run_benchmarks.js` and `scenarios.js` covering 10 synthetic commerce scenarios.
- **STAGE 13 — Dashboard UI:** Built modern glassmorphic web dashboard in `public/index.html`, `public/styles.css`, and `public/app.js`.
- **STAGE 14 & 15 — Security & End-to-End Testing:** 27 unit tests passing + live E2E integration tests passing.
- **STAGE 16 & 17 — Documentation & Demo Preparation:** Created `README.md` and `docs/demo-guide.md`.
- **STAGE 18 & 19 — AI Commerce Experience & Architecture Expansion:**
  1. Product details view & modal with rich specifications, switch acoustics, and verified merchant badges.
  2. Multi-select comparison matrix with side-by-side spec comparison table and AI comparative reasoning.
  3. Slide-in audit drawer and dedicated Developer Lab modal.
  4. Pluggable product provider architecture (`BaseProductProvider` and `InternalCatalogProvider`).
- **STAGE 20 — Security Refactoring & Demo Catalog Expansion:**
  1. Tampered gateway signature defense (constant-time HMAC-SHA256 verification).
  2. Untrusted merchant product description prompt injection defense.
  3. Expanded catalog to 29 items across 6 verified merchants.
- **STAGE 21 — Real Gemini LLM Natural Language Intent Engine Integration:**
  1. Google Gemini Free Tier (`gemini-1.5-flash`) via `GeminiIntentExtractor` using native fetch and strict JSON mode (`responseMimeType: "application/json"`).
  2. Strict Zod schema validation (`IntentConstraintSchema`) and null-budget preservation.
- **STAGE 22 — Lightweight Intent Classification & AI Honesty Engine:**
  1. **Conversational Intent Branching:** Casual greetings ("hi", "hello", "hey", "what can you do?", "help", "thanks") return a friendly guidance response without triggering unnecessary product discovery or hallucinated recommendations.
  2. **Ambiguous Intent Clarification:** Vague queries without identifiable product categories ("I need something good for work", "suggest something for college") prompt the user for category clarification instead of blindly picking a random product.
  3. **Commerce Intent Flow:** Explicit product queries ("find me a wireless keyboard", "headphones for travel") continue through discovery, multi-criteria scoring, and bounded proposal formulation.
  4. **AI Honesty in UI:** Clear visual distinction between `✨ AI Intent Extraction — Gemini` (when Gemini API key is configured and active) and `⚡ Offline Intent Engine` (when running offline or in deterministic fallback mode). Never mislabels deterministic parsing as Gemini.

## Current Task
Intent classification and AI honesty engine verified across all test suites. All 27 unit tests, 10 synthetic benchmarks, and 7 live E2E server checks passing at 100%.

## Next Tasks
1. Optional: Add real Razorpay test mode API keys in `.env` if desired (offline mock fallback is 100% verified and active).
2. Pitch demo recording following `docs/demo-guide.md`.

## Architecture Decisions
- **Dual-Engine Model:** AI Buyer Reasoning Engine (Intent, Discovery, Comparison, Explanation) strictly separated from Deterministic Policy Layer (Hard verification of budget, price consistency, merchant validity, user authorization).
- **Zero-Trust for AI & Merchants:** Free-form AI output cannot directly trigger financial movements; merchant descriptions are treated as untrusted strings and sanitized against prompt injections.
- **Null Unspecified Budget:** Unspecified shopping budget in natural language queries does not trigger artificial hard limits during discovery; financial authorization limits are strictly enforced at the policy layer.
- **Provider-Based Commerce Discovery:** `CatalogService` aggregates registered providers (`InternalCatalogProvider`, future merchant connectors) with normalized product schemas.
- **Razorpay Test Mode with Transparent Mock Fallback:** Real Razorpay Test Mode API calls for Orders, Verification, and Status fetching when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are supplied in `.env`; deterministic mock provider for CI / offline test runs.

## Important Files
- `PROJECT_STATE.md`: Canonical project state.
- `server/index.js`: Main server entry point.
- `server/agents/buyer_agent.js`: Intent classification (conversational, ambiguous, commerce), constraint extraction, and multi-criteria scoring.
- `server/agents/gemini_extractor.js`: Google Gemini Free Tier intent extractor with JSON schema and Zod validation.
- `server/agents/prompts.js`: System prompts for intent classification and extraction.
- `server/agents/sanitizer.js`: Adversarial prompt-injection defense.
- `server/policies/policy_engine.js`: Zero-trust deterministic policy validator.
- `server/policies/spend_token.js`: AP2 cryptographic spend authorization token manager.
- `server/commerce/catalog.js`: Pluggable multi-provider commerce catalog & comparison engine.
- `server/commerce/merchants.js`: Authorized merchant registry with trust scores.
- `server/commerce/providers/base_provider.js`: Base provider abstraction.
- `server/commerce/providers/internal_catalog_provider.js`: Internal catalog provider implementation (29 products).
- `server/payments/razorpay_adapter.js`: Official Razorpay client & mock provider.
- `server/payments/verifier.js`: Constant-time HMAC-SHA256 signature verifier.
- `server/database/audit_store.js`: Immutable audit trail store.
- `server/evaluation/run_benchmarks.js`: 10-scenario synthetic benchmark suite runner.
- `public/index.html`, `public/styles.css`, `public/app.js`: Glassmorphic web application with honest AI source indicators.
- `tests/`: Complete unit and integration test suite (27 tests).

## Commands
- `npm start` — Run server at `http://localhost:3000`.
- `npm test` — Run full unit test suite (27 tests).
- `npm run eval` — Run 10-scenario synthetic benchmark suite.
- `node tests/e2e_api_test.js` — Run live server end-to-end integration test.

## Testing Status
- **Unit Tests:** 27 / 27 Passed (100%)
- **Synthetic Benchmarks:** 10 / 10 Scenarios Passed (100%)
- **Live E2E Server Integration:** 7 / 7 Checks Passed (100%)
