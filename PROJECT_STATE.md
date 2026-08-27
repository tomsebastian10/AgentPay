# Project State

## Current Phase
STAGE 3 — Architecture (Completed) -> Moving to STAGE 4 (Repository Foundation)

## Completed
- Initialized Git repository foundation in `scratch/AgentPay/`
- Configured `.gitignore` for security and clean environment management
- Completed STAGE 0 Challenge Analysis in `docs/challenge-analysis.md` outlining the 13-step Agentic Commerce workflow.
- Completed STAGE 1 Technical Research in `docs/technical-research.md` documenting Razorpay Test Mode APIs and Agentic Commerce protocols.
- Completed STAGE 2 & 3 System Design & Technical Architecture in `docs/architecture.md` specifying the dual-engine modular monolith, Pydantic schemas, policy invariants, spend authorization tokens (AP2 pattern), and REST endpoints.

## Current Task
STAGE 4 — Repository Foundation & Setup (FastAPI Backend, SQLite DB, configuration, environment setup).

## Next Tasks
1. STAGE 4: Build backend repository skeleton, configure `pyproject.toml` / `requirements.txt`, `.env.example`, database setup, and FastAPI entrypoint.
2. STAGE 5: Implement AI Buyer Reasoning Engine (`backend/agents/buyer_agent.py`, intent extraction, adversarial prompt guardrails).
3. STAGE 6: Implement Merchant Catalog & Quote Service (`backend/commerce/`).
4. STAGE 7: Implement Product Discovery & Scoring Matrix.
5. STAGE 8 & 9: Implement Deterministic Policy Engine & Razorpay Payment Integration.

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
