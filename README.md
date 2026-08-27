# AgentPay ⚡ — Autonomous AI Agentic Commerce with Razorpay

[![Buildathon](https://img.shields.io/badge/Razorpay%20AI%20Buildathon-2026-blue.svg)](https://razorpay.com/buildathon/)
[![Track](https://img.shields.io/badge/Track-AI%20Growth%20%26%20Agentic%20Commerce-indigo.svg)]()
[![Tests](https://img.shields.io/badge/Tests-15%2F15%20Passing-success.svg)]()
[![Benchmarks](https://img.shields.io/badge/Evaluation-100%25%20Pass%20Rate-brightgreen.svg)]()

> **AgentPay** is a production-grade Agentic Commerce prototype demonstrating an AI Buyer discovering merchant catalogs, extracting natural language constraints, evaluating multi-attribute commerce options, and executing bounded, cryptographically-authorized payments via **Razorpay Test Mode** with **Zero-Trust Deterministic Policy Safeguards**.

---

## 🎯 Track: AI Growth & Agentic Commerce

As commerce transitions from human browser clicks to autonomous AI agents, financial safety is paramount. LLMs are non-deterministic and susceptible to prompt injection, price drift, and hallucinated spending.

**AgentPay** solves this through a **Dual-Engine Architecture**:
1. **AI Buyer Reasoning Engine:** Handles natural language intent extraction, catalog discovery, candidate scoring, and human explanation.
2. **Deterministic Policy Gatekeeper:** A zero-trust layer enforcing strict mathematical budget limits, real-time price invariance, merchant whitelist verification, cryptographic AP2 token signatures, and anti-replay nonces.

---

## 🏛️ System Architecture

```
[User Intent] 
     │
     ▼
(1) Natural Language Intent Extraction (AI)
     │
     ▼
(2) Structured Constraints Schema (Budget, Specs, Currency)
     │
     ▼
(3) Product Discovery across Merchant Catalogs (x402 Protocol)
     │
     ▼
(4) Multi-Attribute Scoring & Comparison Matrix
     │
     ▼
(5) AI Product Selection & Human Rationale
     │
     ▼
(6) Human-in-the-Loop Spend Authorization (AP2 Protocol Token)
     │
     ▼
(7) Zero-Trust Deterministic Policy Verification
     ├──[REJECTED] ──► Blocked with Exact Violation Code & Alert
     └──[ALLOWED]  ──► Razorpay Order Creation (`/v1/orders`)
                             │
                             ▼
                       Payment Execution & Capture
                             │
                             ▼
                       HMAC-SHA256 Signature Verification
                             │
                             ▼
                       Immutable Audit Trail Append
```

---

## 🛡️ Security & Invariant Guarantees

| Attack / Failure Mode | Protection Mechanism | System Outcome |
|---|---|---|
| **Prompt Injection in Merchant Catalog** | `InputSanitizer` + Boundary Framing | Attack neutralized; product evaluated purely on technical specs. |
| **Merchant Dynamic Price Surge** | Live Quote vs Authorized Token Comparison | Transaction rejected with `ERR_PRICE_DRIFT_DETECTED`. |
| **Hard Budget Exceeded** | Mathematical clamp against user budget | Transaction blocked with `ERR_BUDGET_EXCEEDED`. |
| **Replay Attack / Duplicate Spend** | Single-use cryptographic nonce | Second attempt blocked with `ERR_NONCE_ALREADY_USED`. |
| **Forged Payment Signature** | Constant-time HMAC-SHA256 verification | Verification fails; logged as security violation. |
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

### Environment Setup (Optional for Real Razorpay Test Mode)
Copy `.env.example` to `.env` and provide your test credentials:
```bash
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
PAYMENT_GATEWAY_MODE=test
```
*Note: When test keys are omitted, AgentPay seamlessly operates in deterministic offline Mock mode for instant reproducible evaluation.*

---

## 🧪 Testing & Evaluation Suite

### Run Unit Tests
```bash
npm test
```
*Executes 15 comprehensive unit tests across policy, security, payment, and commerce modules.*

### Run 10-Scenario Synthetic Benchmark Suite
```bash
npm run eval
```
*Runs 10 synthetic commerce benchmark scenarios assessing task completion, safety violations prevented, and latency.*

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
│   ├── agents/                  # AI Buyer & Prompt Injection Sanitizer
│   ├── commerce/                # Multi-merchant catalogs & x402 quotes
│   ├── policies/                # Deterministic Policy Engine & AP2 Tokens
│   ├── payments/                # Razorpay adapter & HMAC verifier
│   ├── database/                # Immutable append-only audit store
│   ├── evaluation/              # 10-scenario benchmark suite
│   └── api/                     # REST API endpoints
├── public/
│   ├── index.html               # Glassmorphic AgentPay Dashboard
│   ├── styles.css               # Modern CSS theme & tokens
│   └── app.js                   # Client shopping application
├── tests/                       # Unit and E2E integration test suite
├── PROJECT_STATE.md             # Canonical project state
├── package.json                 # Dependency manifest
└── .gitignore                   # Clean ignore rules
```

---

## 👥 Authors
Built for the **Razorpay AI Buildathon 2026** (AI Growth & Agentic Commerce).
