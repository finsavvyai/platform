# Email Routing Setup — All Portfolio Domains

## Strategy
Use Cloudflare Email Routing (FREE) to forward product-specific emails to info@finsavvyai.com.
No email hosting needed. Each product gets professional emails on its own domain.

## Setup Steps (per domain)

For each domain in Cloudflare Dashboard:
1. Go to **Email** → **Email Routing** → **Enable**
2. Add **Destination**: `info@finsavvyai.com` (verify once)
3. Add **Routes** (catch-all or specific):
   - `*@domain.com` → `info@finsavvyai.com` (catch-all)
   - OR specific: `hello@`, `support@`, `team@`

## Domains to Configure

| Domain | Emails to Create | Product |
|--------|-----------------|---------|
| lunaos.ai | hello@, support@, team@ | LunaOS |
| coderail.dev | hello@, support@ | CodeRailFlow |
| opensyber.cloud | hello@, support@, security@ | OpenSyber |
| clawpipe.ai | hello@, support@ | ClawPipe |
| push-ci.dev | hello@, support@ | Push-CI |
| pipewarden.dev | hello@, support@, security@ | PipeWarden |
| queryflux.dev | hello@, support@ | QueryFlux |
| qestro.dev | hello@, support@ | Qestro |
| finsavvyai.com | info@, hello@, support@ | Parent company |

## All forward to: info@finsavvyai.com

## Resend Configuration
For SENDING emails (password resets, notifications), use Resend:
- Verified domain: lunaos.ai (already configured)
- From address: noreply@lunaos.ai
- Each product can add its own domain to Resend ($0 for first 100/day)

## Quick Setup Script
For each domain, open in browser:
```
https://dash.cloudflare.com/[account-id]/[domain]/email/routing
```
