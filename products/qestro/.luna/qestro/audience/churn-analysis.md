# Qestro — Churn Analysis & Prevention

**Generated**: 2026-04-09

---

## Early Warning Signals

| Signal | Risk Level | Detection Method |
|--------|-----------|-----------------|
| Login frequency drops 50%+ over 2 weeks | HIGH | Track daily active users per account |
| No test runs in 7+ days (was active weekly) | HIGH | Compare run frequency to baseline |
| Team members removed from project | MEDIUM | Track team seat changes |
| API calls decrease 70%+ (CI disconnected) | HIGH | Monitor API call volume per account |
| Support ticket with negative sentiment | MEDIUM | NLP on ticket content |
| Payment failed + no retry in 3 days | HIGH | Stripe webhook: `invoice.payment_failed` |
| Downgraded plan tier | MEDIUM | Track subscription changes |
| Hasn't used AI generation in 30 days | LOW | Feature usage tracking |

---

## Churn Reasons (Qestro-Specific)

### 1. Missing Features (30% of churn)
**What they tried but couldn't do:**
- Visual regression testing (not yet shipped)
- Safari/Firefox matrix testing in CI (limited)
- Load testing (not built)
- Desktop app for local test authoring (roadmap)

**Save playbook**: Show roadmap timeline, offer early access to beta features.

### 2. Complexity (25% of churn)
**Features they never discovered:**
- Self-healing (many users don't know it exists)
- CI/CD one-click setup (buried in settings)
- API testing (hidden behind "API Studio" nav item)
- Test scheduling (not promoted during onboarding)

**Save playbook**: Trigger feature discovery emails, offer guided walkthrough call.

### 3. Price Sensitivity (20% of churn)
**Signals:**
- Downgrade from Pro to Starter
- Remove team members to reduce seats
- Ask about annual discounts in support
- Compare pricing in feedback

**Save playbook**: Offer 3-month annual discount, startup program, or usage-based pricing trial.

### 4. Competition (15% of churn)
**Competitors stealing users:**
- Cypress Cloud (stronger brand, larger community)
- Playwright native (free, no platform needed)
- BrowserStack (enterprise relationship)

**Save playbook**: Highlight unique value (AI generation, self-healing, unified platform), offer migration assistance.

### 5. Poor Fit (10% of churn)
**Wrong product for their use case:**
- Manual QA teams not ready for automation
- Very small projects (1-2 tests, don't need a platform)
- Non-JavaScript ecosystems (Java, Python native tools preferred)

**Save playbook**: Suggest alternatives gracefully, keep as newsletter subscriber for when they're ready.

---

## Prevention Actions

### Automated Re-engagement

| Trigger | Email Content | Timing |
|---------|-------------|--------|
| No login in 5 days | "Your tests are waiting" + last test results | Day 5 |
| No login in 14 days | "What's blocking you?" survey (3 questions) | Day 14 |
| No login in 30 days | "We've improved since you left" + changelog | Day 30 |
| Payment failed | "Update your payment to keep tests running" | Immediately |
| Downgrade | "Was it something we did?" feedback form | Day 1 post-change |

### In-App Nudges

| Context | Nudge | Goal |
|---------|-------|------|
| User has tests but hasn't run them | "Run your tests" floating action button | Activate |
| Test failed, no self-heal tried | "Try self-healing?" suggestion in results | Feature discovery |
| 80% of plan limit | "You're running low" + upgrade banner | Upsell |
| No CI integration after 2 weeks | "Connect to GitHub in 2 minutes" guide | Deepen integration |

### Personal Outreach Triggers

| Signal | Action | Owner |
|--------|--------|-------|
| Enterprise account health score < 50 | Schedule success call | Customer Success |
| Pro user hasn't logged in for 3 weeks | Personal email from founder | Founder |
| Negative NPS response (1-6) | Follow-up within 24 hours | Support |
| Cancellation request submitted | Offer call before processing | Customer Success |
