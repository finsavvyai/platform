---
name: luna-payments-review
description: Review or suggest payment system architecture — Stripe, LemonSqueezy, PayPal integration patterns, webhook flows, pricing models, and subscription management
homepage: https://agents.lunaos.ai
---

# Luna Payments System Review

When the user wants to review their existing payment implementation or get recommendations for adding a payment system, use this skill.

## How to use

1. Analyze the target codebase (or requirements) for:
   - Current payment provider integrations (Stripe, LemonSqueezy, PayPal, etc.)
   - Webhook handling and event processing
   - Subscription lifecycle management
   - Pricing model and tier structure
   - Checkout flow and UX
   - Billing portal and self-service features
   - Tax handling and invoicing
   - Security: PCI compliance, token handling, idempotency

2. Send to the LunaOS Payments Reviewer agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "payments-reviewer",
    "context": "<payment code or requirements>",
    "useRag": true
  }'
```

3. The agent generates:
   - **Provider Comparison** — Stripe vs LemonSqueezy vs PayPal for the use case
   - **Architecture Review** — current implementation strengths and weaknesses
   - **Webhook Flow Diagram** — Mermaid diagram of payment event processing
   - **Subscription Lifecycle** — state diagram for trial → active → cancelled → expired
   - **Pricing Model Analysis** — flat vs usage-based vs tiered, with recommendations
   - **Security Checklist** — PCI compliance, secret handling, idempotency keys
   - **Checkout UX Review** — friction analysis and conversion optimisation
   - **Implementation Roadmap** — if building from scratch, phased plan

4. Save the output to `.luna/{project}/payments-review.md`.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "review my payment system" or "suggest a payment provider"
- User wants to add subscriptions or billing to their app
- User needs to audit webhook handling for reliability
- User wants pricing model advice

## When NOT to use

- General API design (use luna-architect)
- Non-payment security audits (use luna-security-audit)
