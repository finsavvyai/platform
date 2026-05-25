# TenantIQ Sub-Processor List

Last updated: 2026-04-29

## Active Sub-Processors

| Provider | Purpose | Data Processed | Location |
|----------|---------|----------------|----------|
| Cloudflare | Infrastructure (Workers, D1, KV, R2, Pages) | All tenant data | Global edge |
| Microsoft | Graph API integration | Tenant config, users, licenses, security data | Microsoft cloud (per-tenant region) |
| Anthropic | AI-powered security analysis | Prompt-time tenant metadata (no Graph raw bodies) | US |
| Resend | Transactional email notifications | Recipient email, notification content | US |
| Twilio | SMS alert notifications | Phone number, alert summary | US |
| LemonSqueezy | Billing and subscription management | Payment info, subscription data | US/EU |
| Sentry | Error tracking and performance monitoring | Error context, request metadata (no PII) | US |

> **Authentication note:** TenantIQ uses Microsoft Entra ID delegated OAuth + a self-hosted JWT session (HS256/RS256 via `jose`). No third-party auth provider (no Clerk/Auth0/Cognito).

## Changes

We will notify customers at least 30 days before adding a new sub-processor.
Notifications are sent via email to the organization admin.

## Contact

For questions about sub-processors: privacy@tenantiq.app
