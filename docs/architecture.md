# System Architecture & Technical Design: AgentPay

## Overview

AgentPay is a Node.js 18+ ES-module modular monolith built with Express. It separates optional AI-assisted intent extraction from deterministic commerce, authorization, and payment safeguards.

```
User request
  → Buyer Agent
  → Gemini intent extraction (optional) or deterministic offline intent engine
  → Internal provider-shaped catalog discovery
  → Deterministic product scoring and bounded proposal
  → Explicit human authorization
  → AP2-style HMAC-SHA256 spend authorization token
  → Zero-Trust Policy Engine
  → Razorpay Test Mode order or Mock Gateway order
  → Local Razorpay HMAC verification and JSON-backed audit trail
```

AI never directly controls money. Product discovery, scoring, policy validation, spend authorization, and payment verification remain deterministic.

## Runtime Components

| Component | Implementation | Responsibility |
|---|---|---|
| Server | Express, ES Modules | REST API and static frontend hosting. |
| Buyer Agent | `server/agents/buyer_agent.js` | Sanitizes input, extracts intent, discovers products, scores candidates, and builds proposals. |
| Gemini Extractor | Native `fetch`, Zod | Optional Gemini structured intent extraction; validates untrusted JSON. |
| Offline Intent Engine | Deterministic rules | Handles intent extraction when Gemini is unconfigured, unavailable, times out, errors, or is quota-latched. |
| Catalog | Internal in-memory provider | Normalized products, authorized-merchant filtering, stock, quotes, comparison, and price overrides for demos. |
| Policy Engine | Deterministic checks | Validates token integrity, nonce, merchant, price drift, budget, system cap, and stock before payment. |
| Payments | Razorpay SDK / mock provider | Creates real Test Mode orders when configured or deterministic mock orders otherwise. |
| Audit Store | JSON-backed persistence | Stores audit events and consumed nonces in `data/audit_log.json`. |
| Frontend | Static HTML/CSS/JavaScript | Chat, catalog, comparison, checkout, audit, and demo controls. |

## Gemini Intent Extraction

`GEMINI_API_KEY` is optional. When configured, Gemini is used only for natural-language intent classification and structured constraint extraction; Zod validates and normalizes the response before use.

If Gemini is missing, times out, errors, or returns an invalid result, the buyer agent uses the deterministic offline engine. An HTTP 429 or `RESOURCE_EXHAUSTED` response activates a process-local quota latch: the triggering request falls back immediately, later requests skip Gemini entirely, and restarting Node resets the latch.

## Purchase Flow

1. The buyer agent returns a bounded product proposal and an x402-style internal quote.
2. The user explicitly authorizes the proposal.
3. The server issues an AP2-style spend token signed with HMAC-SHA256 and bound to intent, product, merchant, amount, nonce, and expiry.
4. The policy engine deterministically checks token integrity, replay prevention, merchant authorization, live price drift, budget, system limit, and inventory.
5. Only an allowed transaction creates a Razorpay Test Mode order or a mock order.
6. The server verifies a payment callback signature locally with constant-time HMAC-SHA256 comparison and records audit events.

## Razorpay Modes

- **Razorpay Test Mode:** with valid Test Mode credentials, the adapter creates orders through the Razorpay SDK and the frontend can open Razorpay Checkout.
- **Mock gateway:** without Test Mode configuration, the in-memory provider creates deterministic mock orders and payments for offline use, tests, and demos.
- **Local verification:** payment signatures are verified by AgentPay's local HMAC-SHA256 verifier. The current application does not implement a webhook endpoint or Razorpay payment/status fetching.

## Security Invariants

- Prompt-injection inspection and sanitization for user input and merchant content.
- Authorized merchant, budget, stock, system-limit, and live-price-drift validation.
- AP2-style HMAC-SHA256 spend tokens with five-minute expiry and single-use nonce protection.
- Constant-time Razorpay payment-signature verification.
- JSON-backed audit events for intent, policy, order, payment, and security outcomes.

## API Surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agent/chat` | Extracts intent and returns a deterministic product proposal when applicable. |
| `POST` | `/api/agent/authorize` | Issues an AP2-style spend token after user approval. |
| `POST` | `/api/agent/execute-purchase` | Runs policy validation and creates an order when allowed. |
| `POST` | `/api/agent/verify-payment` | Locally verifies a Razorpay-style HMAC signature. |
| `POST` | `/api/agent/simulate-payment` | Produces mock payment results for offline/test flows. |
| `GET` | `/api/commerce/catalog` | Returns the internal catalog and merchant registry. |
| `POST` | `/api/commerce/compare` | Compares two or three catalog products. |
| `GET` | `/api/audit/logs` | Returns JSON-backed audit events. |
| `POST` | `/api/eval/run` | Runs the ten synthetic benchmark scenarios. |
