# AgentPay ⚡ — Autonomous AI Agentic Commerce with Razorpay

[![Buildathon](https://img.shields.io/badge/Razorpay%20AI%20Buildathon-2026-blue.svg)](https://razorpay.com/buildathon/)
[![Track](https://img.shields.io/badge/Track-AI%20Growth%20%26%20Agentic%20Commerce-indigo.svg)]()
[![Tests](https://img.shields.io/badge/Tests-27%2F27%20Passing-success.svg)]()
[![Benchmarks](https://img.shields.io/badge/Evaluation-100%25%20Pass%20Rate-brightgreen.svg)]()

> **AgentPay** is a production-grade Agentic Commerce prototype demonstrating an AI Buyer discovering merchant catalogs, extracting natural language constraints via Google Gemini with deterministic offline fallback, classifying intent (conversational, ambiguous, commerce), evaluating multi-attribute commerce options, and executing bounded, cryptographically-authorized payments via **Razorpay Test Mode** with **Zero-Trust Deterministic Policy Safeguards**.

---

## 🎯 Track: AI Growth & Agentic Commerce

As commerce transitions from human browser clicks to autonomous AI agents, financial safety is paramount. LLMs are non-deterministic and susceptible to prompt injection, price drift, and hallucinated spending.

**AgentPay** solves this through a **Dual-Engine Architecture**:
1. **AI Buyer Reasoning Engine:** Handles natural language intent classification (conversational greetings vs. ambiguous queries vs. specific commerce), constraint extraction (powered by Google Gemini Free Tier with zero-dependency fallback), catalog discovery across verified merchants, candidate scoring, and human explanation.
2. **Deterministic Policy Gatekeeper:** A zero-trust layer enforcing strict mathematical budget limits, real-time price invariance, merchant whitelist verification, cryptographic AP2 token signatures, and anti-replay nonces with **zero LLM involvement in financial decisions**.

---

## 🏛️ System Architecture

```
User's Natural-Language Request
              │
              ▼
(1) AI Intent Classification & Extraction (Google Gemini / Offline Fallback)
    ├── Conversational (Greetings, Help) ──► Natural Assistant Reply (No Discovery)
    ├── Ambiguous ("something for work") ──► Category Clarification Prompt
    └── Commerce Intent ─────────────────► Structured Constraints Schema (null budget preserved)
              │
              ▼
(2) Product Discovery across Pluggable Merchant Catalogs (Keyboards, Audio, Monitors, Mice, Laptops)
              │
              ▼
(3) Multi-Attribute Scoring & Comparison Matrix (Feature Match, Rating, Merchant Trust, Price)
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
    └── [ALLOWED]  ──► Razorpay Order Creation (`/v1/orders`)
                            │
                            ▼
                      Razorpay Checkout Modal / Test Mode Capture
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

---

## 🚀 Quickstart

### Prerequisites
- Node.js (v18+)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/AgentPay.git
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
*Executes 27 comprehensive unit tests across policy, security, payment, Gemini LLM extractor, intent classification, and commerce modules.*

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
├── tests/                       # Complete unit and integration test suite (27 tests)
├── PROJECT_STATE.md             # Canonical project state
├── package.json                 # Dependency manifest
└── .gitignore                   # Clean ignore rules
```

---

## 👥 Authors
Built for the **Razorpay AI Buildathon 2026** (AI Growth & Agentic Commerce).
