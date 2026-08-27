# Project State

## Current Phase
STAGE 1 — Technical Research (Completed) -> Moving to STAGE 2 & 3 (Design & Architecture)

## Completed
- Initialized Git repository foundation in `scratch/AgentPay/`
- Configured `.gitignore` for security and clean environment management
- Completed STAGE 0 Challenge Analysis in `docs/challenge-analysis.md` outlining the 13-step Agentic Commerce workflow.
- Completed STAGE 1 Technical Research in `docs/technical-research.md` documenting Razorpay Test Mode API schemas (Orders, Checkout, Payments, HMAC SHA-256 verification, Webhooks) and Agentic Commerce protocols (MCP, AP2/ACP tokenization, x402).

## Current Task
STAGE 2 & 3 — System Design & Technical Architecture (`docs/architecture.md`).

## Next Tasks
1. STAGE 2 & 3: Define complete system architecture, data models, and API interfaces in `docs/architecture.md`.
2. STAGE 4: Build repository foundation (FastAPI / Node.js backend setup, SQLite DB, dependency manifests).
3. STAGE 5: Implement AI Buyer Reasoning Engine (Intent Extraction, Constraint Parsing, Comparison, Prompt Injection Guard).
4. STAGE 6: Implement Merchant Interface & Catalog Engine (x402 quotes, standard product models).
5. STAGE 7: Product Discovery & Evaluation Engine.
6. STAGE 8 & 9: Deterministic Policy Engine & Razorpay Test Mode Payment Layer.

## Known Issues
None.

## Architecture Decisions
- **Dual-Engine Model:** AI Buyer Reasoning Engine (Intent, Discovery, Comparison, Explanation) strictly separated from Deterministic Policy Layer (Hard verification of budget, price consistency, merchant validity, user authorization).
- **Zero-Trust for AI & Merchants:** Free-form AI output cannot directly trigger financial movements; merchant descriptions are treated as untrusted strings and sanitized against prompt injections.
- **Razorpay Test Mode Only:** Direct integration with Razorpay Order Creation and HMAC SHA-256 signature verification in Test Mode with fallback simulation layer where needed.

## Important Files
- `PROJECT_STATE.md`: Canonical project state.
- `docs/challenge-analysis.md`: Official track goals, requirements, constraints, and 13-step commerce flow.
- `.gitignore`: Ignore secrets, DBs, node_modules, and cache files.

## Commands
- `git status` — Check repository status.

## Environment
- Target Environment: Node.js / Python (to be finalized in Architecture).
- Required Keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `LLM_API_KEY` (Test mode / sandbox credentials only).

## Testing Status
Initial project setup verified.
