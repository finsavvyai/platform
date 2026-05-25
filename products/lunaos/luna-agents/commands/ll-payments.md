---
name: ll-payments
displayName: Luna Payments System Review
description: Review or suggest payment system architecture — providers, webhooks, subscriptions, pricing, security
version: 1.0.0
category: review
agent: luna-payments-reviewer
parameters:
  - name: scope
    type: string
    description: Project scope or specific payment concern to review
    required: true
    prompt: true
workflow:
  - scan_payment_integrations
  - analyse_webhook_handling
  - review_subscription_lifecycle
  - evaluate_pricing_model
  - audit_payment_security
  - generate_payments_review
output:
  - .luna/{current-project}/payments-review.md
prerequisites:
  - source_code
---

# Luna Payments System Review

Reviews your existing payment implementation or suggests a payment architecture. Covers provider selection, webhook reliability, subscription lifecycle, pricing models, and PCI compliance.

## What This Command Does

This command analyses your payment-related code (or gathers requirements if none exists yet) and produces a comprehensive review with recommendations, security audit, and implementation roadmap.

## Prerequisites

Requires in your current project:
- Source code (with or without existing payment integration)

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full payment system review
- Type **webhooks** / **pricing** / **security** for focused review

## Execution Steps

1. **Integration Scan**: Finds Stripe, LemonSqueezy, PayPal, or other provider code
2. **Webhook Analysis**: Reviews event handling, retry logic, and idempotency
3. **Subscription Review**: Audits trial → active → cancelled → expired lifecycle
4. **Pricing Evaluation**: Analyses flat vs usage-based vs tiered model fit
5. **Security Audit**: Checks PCI compliance, secret handling, token management
6. **Review Generation**: Produces `payments-review.md` with recommendations

## Output Files

Creates in your current project:
- `.luna/{current-project}/payments-review.md`

Includes:
- Provider comparison (Stripe vs LemonSqueezy vs PayPal) for the use case
- Architecture review with strengths and weaknesses
- Mermaid webhook flow diagram
- Subscription lifecycle state diagram
- Pricing model analysis with recommendations
- Security checklist (PCI, secrets, idempotency)
- Checkout UX friction analysis
- Implementation roadmap (if building from scratch)

## Next Steps in Workflow

After payments review:
```
/luna-plan         # Plan implementation of recommendations
/luna-execute      # Execute payment system changes
/luna-test         # Test payment flows
```

## Tips

- Run before launching billing to catch security issues early
- The webhook diagram helps visualise event processing reliability
- Pair with `/luna-review` for a full code quality assessment
