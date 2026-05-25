# Qestro — Open-Source Synergy Map

**Generated**: 2026-04-09

---

## Tool Synergies (tools that amplify each other)

### PostHog + Churn Analysis
PostHog's event tracking feeds directly into the churn prevention system from the audience analysis. Track:
- `test_generated` — AI test creation (activation signal)
- `test_run_completed` — execution frequency (engagement signal)
- `self_heal_triggered` — healing usage (stickiness signal)
- `baseline_approved` — visual regression usage (new feature adoption)
- `plan_limit_reached` — upsell trigger

### Sentry + Self-Healing Engine
When Sentry captures a frontend error, the self-healing engine can auto-generate a regression test for the failing interaction. Error → test → prevention loop.

### Storybook + Visual Regression Engine
Storybook stories become automatic baselines for the visual regression engine. Every component gets pixel-perfect snapshot testing for free. The `ComparisonView` component can render inside Storybook to review diffs.

### Resend + Audience Growth Strategy
Transactional emails power the churn prevention playbooks:
- Week 1: Welcome + "Generate first test" CTA
- Week 2: Test failed → "Try self-healing" education
- Week 3: 80% plan limit → upgrade nudge
- Day 30 inactive: Win-back with changelog

### QStash + Test Scheduling
The existing test scheduler (`TestSchedulerService.ts`) uses Bull which requires Redis. QStash replaces this for Workers — schedule visual regression tests via HTTP callbacks, no persistent connection needed.

### PostHog Feature Flags + Pricing Experiments
Test pricing changes (annual discount, startup program) without code deploys. Feature flags control which pricing page variant users see. Measure conversion rates per variant.

### OpenTelemetry + AI Cost Tracking
Trace AI calls through the Claw Gateway to measure: latency per provider, cache hit rate (ReasoningBank), cost per test generation. Feeds into Smart Router optimization.

---

## Integration with Existing Systems

| New Tool | Integrates With | How |
|----------|----------------|-----|
| PostHog | `shared/monitoring/index.ts` | Replace TelemetryService event tracking |
| Sentry | `backend/src/utils/logger.ts` | Forward `error` level logs to Sentry |
| Zod | `frontend/src/pages/LoginPage.tsx` | zodResolver for react-hook-form |
| Resend | `backend/src/services/email/` | Replace Nodemailer/SendGrid |
| QStash | `backend/src/services/TestSchedulerService.ts` | Replace Bull queue |
| jsPDF | `frontend/src/pages/AnalyticsDashboard.tsx` | "Export PDF" button |
| Radix UI | `frontend/src/components/atoms/` | Replace custom Modal, Select, Tooltip |
| OTEL | `backend/src/lib/finsavvyai-init.ts` | Init tracing alongside other infra |
| Trigger.dev | `backend/src/workers/aiProcessor.ts` | Replace Redis-based job queue |
| Storybook | `frontend/src/components/` | Stories for all 50+ components |
