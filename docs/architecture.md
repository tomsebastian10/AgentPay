# System Architecture & Technical Design: AgentPay

## 1. High-Level Architecture Overview

AgentPay adopts a **Dual-Engine Modular Monolith** architecture designed for maximum security, deterministic financial boundaries, and lightning-fast execution.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT / FRONTEND                                    │
│  - AI Shopping Chat Interface          - Product Comparison Matrix                      │
│  - Interactive Spend Authorization     - Live Razorpay Checkout Modal                   │
│  - Real-Time Transaction Audit Trail   - Adversarial & Failure Scenario Simulator       │
└───────────────────────────────────────────▲────────────────────────────────────────────┘
                                            │ REST / JSON-RPC
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                                 FASTAPI APPLICATION CORE                                │
│                                                                                        │
│  ┌───────────────────────────┐                ┌─────────────────────────────────────┐  │
│  │   AI BUYER REASONING      │                │    DETERMINISTIC POLICY ENGINE      │  │
│  │   ENGINE (Non-Deterministic)│               │    (Zero-Trust Gatekeeper)          │  │
│  │                           │                │                                     │  │
│  │ • Intent & Constraint     │   Proposes     │ • Budget Cap Verification           │  │
│  │   Extractor               │  Transaction   │ • Price Invariance / Drift Guard    │  │
│  │ • Prompt Injection Filter │───────────────►│ • Merchant Whitelist Validation     │  │
│  │ • Multi-Product Scorer    │   Proposal     │ • AP2 / Spend Token Verification    │  │
│  │ • Decision Explainer      │                │ • Anti-Replay / Idempotency Check   │  │
│  └───────────────────────────┘                └──────────────────┬──────────────────┘  │
│                                                                  │                     │
│                                                    [ALLOWED]     │  [REJECTED]         │
│                                                       │          │     │               │
│                                                       ▼          ▼     ▼               │
│  ┌───────────────────────────┐                ┌─────────────────────────────────────┐  │
│  │    COMMERCE & CATALOGS    │                │       RAZORPAY PAYMENT GATEWAY      │  │
│  │ • Multi-Merchant Network  │                │ • Razorpay Test Mode Client         │  │
│  │ • x402 Real-Time Quotes   │                │ • Order Creation (`/v1/orders`)     │  │
│  │ • Inventory Availability  │                │ • HMAC-SHA256 Signature Verifier    │  │
│  └───────────────────────────┘                │ • Webhook Event Processor           │  │
│                                               │ • Deterministic Fallback Simulator  │  │
│                                               └─────────────────────────────────────┘  │
│                                                                  │                     │
│  ┌───────────────────────────────────────────────────────────────▼──────────────────┐  │
│  │                           IMMUTABLE AUDIT TRAIL & SQLITE                         │  │
│  │  Records: Intents, Extracted Constraints, Candidates, Quotes, Policy Decisions,  │  │
│  │  Spend Tokens, Razorpay Order IDs, Payment Signatures, Gateway Responses         │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 AI Buyer Engine (`backend/agents/`)
- **Intent Extractor:** Converts natural language (e.g., *"Find a wireless mechanical keyboard under ₹8,000"*) into a strongly-typed Pydantic `CommerceConstraint` schema:
  - `category`: string
  - `max_budget_inr`: float
  - `currency`: `"INR"`
  - `must_have_features`: list[string] (e.g. `["wireless", "mechanical"]`)
  - `nice_to_have_features`: list[string]
- **Adversarial Input Sanitizer:** Strips out jailbreaks, delimiter injections, and malicious system prompt overrides from merchant product titles/descriptions.
- **Product Scorer & Decision Engine:** Evaluates merchant product candidates using normalized multi-criteria utility functions (Price fit, Feature match, Rating, Merchant trust score).
- **Explanation Generator:** Formulates transparent, user-understandable justifications for why product X was chosen over product Y.

### 2.2 Deterministic Policy Layer (`backend/policies/`)
Acts as the zero-trust gatekeeper between AI reasoning and financial transactions:
- **Policy Invariants:**
  1. $\text{Quote Amount} \le \text{Max Budget}$
  2. $\text{Live Order Amount} == \text{Authorized Quote Amount}$ (Protects against dynamic price surging)
  3. $\text{Currency} == \text{'INR'}$
  4. $\text{Merchant ID} \in \text{Registered Merchants}$
  5. $\text{Stock Quantity} \ge \text{Order Quantity}$
  6. $\text{Authorization Token Nonce}$ is unused (Strict Idempotency).
  7. $\text{Spend Token Expiration} > \text{Current Timestamp}$.
- If any check fails, the policy layer immediately returns `POLICY_REJECTED` with an exact violation code. The payment layer is **never invoked**.

### 2.3 Spend Authorization Tokens (AP2 Protocol Pattern)
- When a user confirms a purchase proposal, the system issues a cryptographically signed `SpendAuthorizationToken`:
  - `token_id`: UUIDv4
  - `intent_id`: UUIDv4
  - `product_id`: string
  - `merchant_id`: string
  - `authorized_amount_paise`: integer (e.g., `749900`)
  - `currency`: `"INR"`
  - `expires_at`: ISO timestamp (5-minute TTL)
  - `user_signature`: HMAC-SHA256 signature generated with user session key.

### 2.4 Razorpay Payment Gateway Adapter (`backend/payments/`)
- **Real Razorpay Mode:**
  - Calls `razorpay.Client.order.create()` with exact amount in paise.
  - Verifies `razorpay_signature` via `razorpay.utility.verify_payment_signature()`.
- **Test Mode Simulation Layer:**
  - Clearly labeled mock engine that simulates standard Razorpay responses, webhook events, and test error conditions (e.g., `payment.failed`, `insufficient_funds`, `gateway_timeout`) for reproducible automated testing without network flakiness.

### 2.5 Multi-Merchant Catalog Engine (`backend/commerce/`)
- Simulates realistic e-commerce merchants (e.g., *Keychron Direct, MechKeyboard Hub, TechVibe Electronics*).
- Implements HTTP 402 / Quote API to generate signed, time-limited price quotes.

---

## 3. Data Models & Schemas

```python
class CommerceConstraint(BaseModel):
    category: str
    max_budget_inr: float
    currency: str = "INR"
    required_features: list[str] = []
    preferred_brands: list[str] = []

class Product(BaseModel):
    id: str
    merchant_id: str
    merchant_name: str
    title: str
    description: str
    price_inr: float
    price_paise: int
    features: list[str]
    in_stock: bool
    stock_count: int
    rating: float

class PurchaseProposal(BaseModel):
    intent_id: str
    product_id: str
    merchant_id: str
    product_title: str
    final_price_inr: float
    final_price_paise: int
    reasoning: str
    comparison_summary: list[dict]

class PolicyEvaluationResult(BaseModel):
    allowed: bool
    violations: list[str] = []
    evaluated_at: str
    policy_hash: str

class AuditEvent(BaseModel):
    id: str
    timestamp: str
    event_type: str  # INTENT_EXTRACTED | QUOTES_FETCHED | PROPOSAL_GENERATED | AUTHORIZATION_GRANTED | POLICY_CHECK | ORDER_CREATED | PAYMENT_VERIFIED | FAILURE_ABORTED
    payload: dict
    status: str
```

---

## 4. API Endpoints Specification

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agent/chat` | Receives user NL query, extracts constraints, queries catalogs, selects product, returns structured proposal. |
| `POST` | `/api/agent/authorize` | User reviews proposal and signs `SpendAuthorizationToken`. |
| `POST` | `/api/agent/execute-purchase` | Runs Policy Engine; if allowed, calls Razorpay Orders API (`/v1/orders`) and returns `order_id`. |
| `POST` | `/api/agent/verify-payment` | Receives payment ID & signature, performs HMAC-SHA256 verification, captures order, updates audit log. |
| `GET` | `/api/merchants/catalog` | Lists available merchant products. |
| `GET` | `/api/audit/logs` | Fetches immutable audit trail events. |
| `POST` | `/api/eval/run` | Triggers synthetic test suite and returns performance/safety metrics. |
| `POST` | `/api/scenarios/simulate` | Triggers specific demonstration scenarios (Price Hike, Prompt Injection, Payment Failure). |

---

## 5. Security & Invariant Guarantee Matrix

| Threat / Edge Case | Protection Mechanism | Expected Outcome |
|---|---|---|
| **Prompt Injection in Merchant Catalog** | Strict JSON schema parsing + isolated markdown sanitizer + boundary prompts | Malicious instructions ignored; product scored purely on valid technical attributes. |
| **Merchant Price Hike before Checkout** | Policy Engine compares `live_quote.price` with `authorized_token.price` | Transaction blocked immediately; User alerted of price drift. |
| **Budget Exceeded** | Policy Engine hard clamps `price <= user_budget` | Transaction blocked; Agent explains budget breach. |
| **Duplicate / Replay Attack** | Single-use Spend Token Nonce stored in SQLite | Second execution attempt rejected as `NONCE_ALREADY_USED`. |
| **Forged Payment Signature** | Backend constant-time HMAC-SHA256 signature verification | Verification fails; Order marked `PAYMENT_UNVERIFIED_FRAUD`. |
| **Payment Gateway Downtime / Failure** | Error interception & recovery handler | Clear failure notification; Audit log marked `PAYMENT_FAILED`. |
