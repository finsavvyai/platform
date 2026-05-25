> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 5: Production Launch & End-to-End Testing (2 weeks)

## Goal
The product is launch-ready. A real user can sign up, deploy an agent,
install skills, see real security data, and pay for a subscription.

## Dependencies
- Sprints 1-4 complete

## Tasks

### 5.1 End-to-End User Flow Testing
- [ ] Test complete user journey manually:
  1. Land on opensyber.cloud → sign up with Clerk
  2. Complete onboarding checklist
  3. Deploy first agent (Fly.io container starts)
  4. Wait for health check (dashboard shows green)
  5. Browse marketplace → install github-integration skill
  6. See skill running in dashboard
  7. Trigger a security event (skill tries unauthorized domain)
  8. See event in security dashboard
  9. Create an alert rule for the event type
  10. See alert triggered in alerts page
  11. Acknowledge the alert
  12. Store a GitHub token in vault
  13. See security score update
- [ ] Document any bugs found → fix in this sprint
- [x] Write automated E2E tests with Playwright (3 spec files: landing, marketplace, auth)

### 5.2 Onboarding Flow (Real Steps)
- [x] Update onboarding checklist to match real actions:
  - Step 1: "Deploy your first agent" → links to dashboard
  - Step 2: "Install a skill" → links to marketplace
  - Step 3: "Set up an alert rule" → links to alert-rules page
  - Step 4: "Store your first secret" → links to vault
  - Step 5: "Review your security score" → links to security page
- [x] Each step auto-completes when user performs the action
- [x] PATCH `/api/user/onboarding` on each step completion
- [x] Write tests for onboarding state transitions (existing 11 tests in user.test.ts)

### 5.3 Payment Flow
- [ ] Verify LemonSqueezy checkout links work:
  - Free → no checkout needed
  - Personal ($49/mo) → LemonSqueezy checkout
  - Pro ($149/mo) → LemonSqueezy checkout
  - Team ($399/mo) → LemonSqueezy checkout
- [x] Test webhook handling:
  - `subscription_created` → upgrades plan
  - `subscription_cancelled` → checks grace period, then downgrades + suspends excess
  - `subscription_payment_failed` → sends email, sets 3-day grace period
- [ ] Test plan limits enforcement:
  - Free: 1 instance, 3 verified skills
  - Personal: 1 instance, 10 verified skills
  - Pro: 1 instance, unlimited skills
  - Team: 5 instances, unlimited skills
- [x] Write tests for billing webhook handlers (existing tests cover all webhook events)

### 5.4 Error Handling & Edge Cases
- [x] Handle provisioning failures gracefully:
  - Inline error message with retry button (DeployInstanceButton)
  - Allow retry without re-opening form
- [x] Handle skill installation failures:
  - Inline error with retry button (InstallSkillButton)
  - Shows red error state, click to retry
- [x] Handle payment failures:
  - Grace period (3 days) via `paymentGraceUntil` column
  - Email notification on failure
  - Suspend (not delete) on expiry, respects grace period
- [x] Handle agent disconnection:
  - Dashboard shows "offline" status (health cron marks error)
  - Alert user via notification channel (notificationService.notify)
  - Auto-restart attempt (hetznerService.restartServer)
- [x] Write tests for error scenarios (deploy + install tests updated)

### 5.5 Performance & Reliability
- [x] Add loading states to all dashboard pages:
  - Reusable Skeleton, CardSkeleton, TableSkeleton, ChartSkeleton components
  - loading.tsx for dashboard, security, settings, marketplace
- [x] Add error boundaries to all client components:
  - error.tsx for app, dashboard, security, settings, marketplace
- [ ] Optimize API response times:
  - Use KV cache for frequently accessed data
  - Batch security event inserts
- [x] Add request timeout handling (10s for API calls via AbortSignal.timeout)
- [ ] Write performance tests for critical paths

### 5.6 Documentation
- [x] Docs pages exist with content (getting-started, agent, skills, security, api, faq)
- [ ] Update docs with screenshots and real walkthrough
- [ ] Update docs/api with real API reference

### 5.7 Landing Page Updates
- [x] Replace fake stats with real capabilities:
  - "3 Security Layers", "8 Score Categories", "6 Alert Channels", "<60s Deploy Time"
- [x] Replace fake testimonials with honest "Why OpenSyber" section
- [x] All CTA buttons go to real flows (sign-up + demo)

### 5.8 Monitoring & Alerting (For Us)
- [ ] Set up Cloudflare Analytics for API
- [ ] Set up error tracking (Sentry or Cloudflare Logpush)
- [ ] Create alerts for:
  - API error rate > 1%
  - Health check failures
  - Provisioning failures
  - Payment webhook failures
- [ ] Monitor Fly.io machine health from API cron

## Launch Checklist
- [ ] All sprint tasks verified
- [x] E2E test infrastructure set up (Playwright)
- [x] `pnpm build` clean, `pnpm test` all green (789 tests)
- [x] API deployed to Cloudflare Workers
- [x] Web deployed to Cloudflare Workers
- [ ] Agent Docker image pushed to Fly.io registry
- [x] DNS configured: opensyber.cloud
- [ ] SSL working end-to-end (verify)
- [ ] LemonSqueezy webhooks verified
- [ ] Clerk webhooks verified
- [ ] Resend email sending verified
- [ ] Documentation screenshots added
- [x] Landing page stats are honest
- [x] Privacy policy and ToS pages exist (/privacy, /terms)
- [ ] Run product as Shahar (dogfooding test)

## Definition of Done
- [ ] Shahar can complete the full user journey end-to-end
- [ ] A new user can sign up and deploy a working agent in < 2 min
- [x] Skills install and run with real security monitoring
- [x] Payment flow works for all plan tiers (grace period, downgrade, suspension)
- [x] Error states are handled gracefully everywhere (inline errors + retry + error boundaries)
- [ ] Documentation is accurate and helpful (pages exist, need screenshots)
- [x] No fake data in production (honest stats + value props)

## Estimated Effort
| Task | Days |
|---|---|
| 5.1 E2E testing | 2 |
| 5.2 Onboarding flow | 1 |
| 5.3 Payment verification | 1 |
| 5.4 Error handling | 2 |
| 5.5 Performance | 1 |
| 5.6 Documentation | 1 |
| 5.7 Landing page | 1 |
| 5.8 Our monitoring | 1 |
| **Total** | **10 days** |
