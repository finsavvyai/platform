# FinSavvyAI — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 1 · **Readiness:** 85% · **Stack:** Python (FastAPI), Node.js CLI, Go Desktop, Swift iOS
> **Timeline:** 5 days · **Ship by:** Week 3

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Enable auth by default + integrate finsavvyai-auth [PARALLEL]

**Prompt:**
FinSavvyAI currently has bcrypt in isolation. Install `finsavvyai-auth` (PyPI), integrate into FastAPI app via FastAPI `Depends()`. Replace `bcrypt.hashpw()` calls with `finsavvyai_auth.hash_password()`. Enable OAuth2 password flow: create `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")`, route `/auth/token` using `finsavvyai_auth.create_access_token()`. Add `.env` with SECRET_KEY. Create test fixtures for authenticated and unauthenticated requests. Acceptance: POST `/auth/token` with email+password returns JWT, JWT validates on protected endpoints, `pytest -v` shows 95%+ coverage.

### Agent B: Commit 250 pending changes + PyPI publish [PARALLEL]

**Prompt:**
FinSavvyAI has 250 uncommitted changes in staging. Run `git status` to identify all pending changes, create meaningful commits by feature (e.g., "feat: auth integration", "fix: CLI argument parsing", "docs: README update"). Ensure each commit message follows Conventional Commits. Update version in `setup.py` or `pyproject.toml` (e.g., 0.5.0 → 0.6.0). Run `pytest -v --cov=src --cov-fail-under=95` before finalizing. Publish to PyPI: `poetry publish` or `python -m build && twine upload dist/*`. Acceptance: All 250 changes committed, PyPI shows new version, `pip install finsavvyai==X.Y.Z` succeeds.

---

## Sprint Tasks

### Agent C: Landing page with @finsavvyai/ui [PARALLEL]

**Prompt:**
FinSavvyAI needs a landing page. Use React + Tailwind or @finsavvyai/ui components. Create `/frontend/pages/index.tsx` with hero section (headline, subheadline, CTA button), features grid (3-4 cards), testimonials section, FAQ accordion, footer. Follow Apple HIG: SF Pro typography, 8pt grid spacing, system colors (#007AFF primary), dark mode support via `prefers-color-scheme`. Include ARIA labels on buttons, focus states 2px outline, keyboard navigation (Tab through all interactive elements). Test with 5 personas: unauthenticated guest views page, free-tier user sees pricing tier info, pro subscriber sees dashboard link, admin sees admin panel link, expired user sees re-subscribe CTA. Acceptance: Landing page deploys to production domain, all personas render correctly, accessibility passes WCAG AA.

### Agent D: Payment integration with finsavvyai-pay [SEQUENTIAL]

**Prompt:**
FinSavvyAI offers free + pro tiers. Integrate `finsavvyai-pay` (PyPI). Install package, create payment provider: `from finsavvyai_pay import create_payment_provider; provider = create_payment_provider('stripe', api_key=os.getenv('STRIPE_API_KEY'))`. Wire `/api/checkout` endpoint: `@app.post("/checkout"); async def checkout(plan: str) -> CheckoutSession`. Implement webhook handler at `/api/webhooks/payment`. Add payment models: `class Subscription(Base)` with user_id, plan, status, expires_at. Test: checkout redirects to payment, webhook on success updates DB subscription, expired subscription reverts user to free tier. Acceptance: End-to-end payment flow works, subscription state syncs, webhook validates.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL — after all above]

**Prompt:**
Verify FinSavvyAI passes all gates: (1) `pytest -v --cov=src --cov-fail-under=95` shows 95%+ coverage. (2) Line count: `find src -name '*.py' | xargs awk 'END{if(NR>200) print FILENAME": "NR" lines"}'`. (3) Security: `bandit -r src/` zero high/critical findings. (4) Apple HIG: SF Pro fonts, 8pt grid, system colors, dark mode adaptive. (5) Zod/Pydantic validation on all API endpoints — POST `/checkout` validates `plan` enum. (6) No secrets in code (env vars only). (7) Auth enabled: protected endpoints require JWT. (8) Browser personas: guest, free, pro, admin, expired — all work. Acceptance: All checks pass, zero blockers.

---

## Quality Gate Checklist

□ 95%+ test coverage (`pytest --cov=src --cov-fail-under=95`)
□ ≤200 lines per source file
□ SOLID principles (service layer, dependency injection)
□ Security scan clean (`bandit -r src/` zero high/critical)
□ No secrets in code (`.env` only)
□ Input validation (Pydantic models on all API inputs)
□ Apple HIG (SF Pro, 8pt grid, system colors, dark mode, ARIA)
□ Auth enabled by default (OAuth2 with finsavvyai-auth)
□ Payment integration (finsavvyai-pay + webhook validation)
□ Browser test personas: guest, free, pro, admin, expired — all pass
