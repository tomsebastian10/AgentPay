# AgentPay ⚡ — Autonomous AI Agentic Commerce with Razorpay

[![Buildathon](https://img.shields.io/badge/Razorpay%20AI%20Buildathon-2026-blue.svg)](https://razorpay.com/buildathon/)
[![Track](https://img.shields.io/badge/Track-AI%20Growth%20%26%20Agentic%20Commerce-indigo.svg)]()
[![Tests](https://img.shields.io/badge/Tests-29%2F29%20Passing-success.svg)]()
[![Benchmarks](https://img.shields.io/badge/Evaluation-100%25%20Pass%20Rate-brightgreen.svg)]()

> **AgentPay** is an Agentic Commerce prototype that optionally uses Google Gemini for intent extraction, then deterministically discovers, scores, authorizes, and safeguards purchases through Razorpay Test Mode or its offline mock gateway.

---

## 🎯 Track: AI Growth & Agentic Commerce

As commerce transitions from human browser clicks to autonomous AI agents, financial safety is paramount. LLMs are non-deterministic and susceptible to prompt injection, price drift, and hallucinated spending.

**AgentPay** solves this through a **Dual-Engine Architecture**:
1. **Buyer Agent:** Uses optional Gemini or a deterministic offline engine for natural-language intent classification and structured constraint extraction. Product discovery, candidate scoring, and explanations are deterministic.
2. **Deterministic Policy Gatekeeper:** A zero-trust layer enforcing strict mathematical budget limits, real-time price invariance, merchant whitelist verification, cryptographic AP2 token signatures, and anti-replay nonces with **zero LLM involvement in financial decisions**.

---

## 🏛️ System Architecture

```
User's Natural-Language Request
              │
              ▼
(1) Intent Classification & Extraction (Optional Gemini / Deterministic Offline Engine)
    ├── Conversational (Greetings, Help) ──► Natural Assistant Reply (No Discovery)
    ├── Ambiguous ("something for work") ──► Category Clarification Prompt
    └── Commerce Intent ─────────────────► Structured Constraints Schema (null budget preserved)
              │
              ▼
(2) Product Discovery across Pluggable Merchant Catalogs (Keyboards, Audio, Monitors, Mice, Laptops)
              │
              ▼
(3) Deterministic Multi-Attribute Scoring & Comparison Matrix (Feature Match, Rating, Merchant Trust, Price)
              │
              ▼
(4) Bounded Purchase Proposal & Human Explanation (x402 Protocol Quote with TTL)
              │
              ▼
(5) Explicit Human Authorization via Dashboard
              │
              ▼
(6) AP2 Spend Authorization Token Issued (HMAC-SHA256 bound to intent, product, merchant, price, nonce)
              │
              ▼
(7) Zero-Trust Deterministic Policy Verification
    ├── [REJECTED] ──► Blocked with Exact Violation Code & Audit Event
    └── [ALLOWED]  ──► Razorpay Test Mode Order Creation or Mock Gateway Order
                            │
                            ▼
                      Razorpay Checkout (Test Mode) / Deterministic Mock Payment
                            │
                            ▼
                      Constant-Time HMAC-SHA256 Signature Verification (`crypto.timingSafeEqual`)
                            │
                            ▼
                      Immutable Append-Only Audit Ledger Receipt
```

---

## 🛡️ Security & Invariant Guarantees

| Attack / Failure Mode | Protection Mechanism | System Outcome |
|---|---|---|
| **Prompt Injection in Merchant Catalog** | `InputSanitizer` + Merchant Registry Isolation | Malicious merchant product excluded; injection directives neutralized. |
| **Merchant Dynamic Price Surge** | Live Quote vs. Authorized Token Comparison | Transaction rejected with `ERR_PRICE_DRIFT_DETECTED`. |
| **Hard Budget Exceeded** | Mathematical clamp against user budget | Transaction blocked with `ERR_BUDGET_EXCEEDED` (unspecified budgets remain `null`). |
| **Replay Attack / Duplicate Spend** | Single-use cryptographic nonce | Second attempt blocked with `ERR_NONCE_ALREADY_USED`. |
| **Tampered / Forged Gateway Signature** | Constant-time HMAC-SHA256 verification | Tampered gateway callback rejected; payment not authorized. |
| **Gateway Failure / Card Decline** | Gateway error interceptor | Honestly reported as `PAYMENT_FAILED` (never false success). |

Gemini is optional. `GEMINI_API_KEY` enables Gemini intent extraction, whose JSON output is validated by Zod. Missing configuration, errors, timeouts, or quota exhaustion use the offline engine. After a Gemini HTTP 429 / `RESOURCE_EXHAUSTED`, the process-local latch skips Gemini until the server restarts. AI never directly controls money.

## 🧱 Implementation Stack

- Node.js 18+, Express, and ES Modules
- Zod, native `fetch` for Gemini, and the Razorpay SDK
- Internal in-memory catalog with provider-shaped interfaces
- JSON-backed audit persistence
- Static HTML, CSS, and JavaScript frontend

---

## 🚀 Quickstart

### Prerequisites
- Node.js (v18+)

### Installation
```bash
# Clone the repository
git clone https://github.com/tomsebastian10/AgentPay
cd AgentPay

# Install dependencies
npm install

# Start the application
npm start
```

Open your browser at **`http://localhost:3000`**.

### Environment Setup (Optional for Real Razorpay Test Mode & Gemini LLM)
Copy `.env.example` to `.env` and configure:
```bash
# Razorpay Test Mode Credentials (Optional: system runs in mock mode when omitted)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
PAYMENT_GATEWAY_MODE=test

# Google Gemini Free Tier API Key (Optional: deterministic rule engine is used when omitted)
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🧪 Testing & Evaluation Suite

### Run Unit Tests
```bash
node --test tests/**/*.test.js
```
*Executes 29 comprehensive unit tests across policy, security, payment, Gemini intent extraction, intent classification, and commerce modules.*

### Run 10-Scenario Synthetic Benchmark Suite
```bash
npm run eval
```
*Runs 10 automated synthetic commerce benchmark scenarios assessing task completion, budget clamping, price drift invariance, prompt injection immunity, replay defense, and forged signature rejection.*

### Run Live Server End-to-End API Integration
```bash
node tests/e2e_api_test.js
```
*Executes 7 live HTTP workflow integration checks against the running server.*

---

## 📁 Repository Structure

```
AgentPay/
├── docs/
│   ├── challenge-analysis.md    # STAGE 0 Challenge Analysis & Track Goals
│   ├── technical-research.md    # STAGE 1 Razorpay APIs & Protocols
│   ├── architecture.md          # STAGE 2 & 3 System Design & Schemas
│   └── demo-guide.md            # Pitch demo & scenario guide
├── server/
│   ├── config.js                # Environment configuration
│   ├── index.js                 # Express server entry point
│   ├── agents/                  # AI Buyer, Gemini Extractor & Input Sanitizer
│   │   ├── buyer_agent.js       # Intent classification, constraints, and candidate scoring
│   │   ├── gemini_extractor.js  # Google Gemini Free Tier client with strict Zod validation
│   │   ├── prompts.js           # System prompts for intent extraction and reasoning
│   │   └── sanitizer.js         # Adversarial prompt-injection defense
│   ├── commerce/                # Multi-merchant catalogs, x402 quotes, & comparison
│   │   ├── catalog.js           # Pluggable catalog service & quote manager
│   │   ├── merchants.js         # Authorized merchant registry with trust scores
│   │   └── providers/           # BaseProductProvider & InternalCatalogProvider (29 items)
│   ├── policies/                # Deterministic Policy Engine & AP2 Spend Tokens
│   ├── payments/                # Razorpay adapter & constant-time HMAC verifier
│   ├── database/                # Immutable append-only audit store
│   ├── evaluation/              # 10-scenario synthetic benchmark suite
│   └── api/                     # REST API endpoints
├── public/
│   ├── index.html               # Glassmorphic AgentPay Dashboard with Drawer & Lab
│   ├── styles.css               # Modern CSS theme, tokens, & responsive layout
│   └── app.js                   # Client shopping application with honest AI badges
├── tests/                       # Complete unit and integration test suite (29 tests)
├── PROJECT_STATE.md             # Canonical project state
├── package.json                 # Dependency manifest
└── .gitignore                   # Clean ignore rules
```

---

## 👥 Authors
Built for the **Razorpay AI Buildathon 2026** (AI Growth & Agentic Commerce).
