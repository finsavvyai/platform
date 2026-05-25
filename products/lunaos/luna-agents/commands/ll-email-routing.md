---
name: ll-email-routing
displayName: Luna Email Routing
description: Set up free email forwarding for any domain using Cloudflare Email Routing — no email hosting needed
version: 1.0.0
category: infrastructure
agent: luna-task-executor
parameters:
  - name: domain
    type: string
    description: "Domain to configure (e.g., 'myapp.ai') or 'all' for all portfolio domains"
    required: true
    prompt: true
  - name: destination
    type: string
    description: "Destination email to forward to"
    required: false
    default: "info@finsavvyai.com"
  - name: addresses
    type: string
    description: "Email addresses to create (comma-separated, or 'catchall')"
    required: false
    default: "catchall"
prerequisites:
  - Domain must be on Cloudflare
  - API token with Zone:Read + Email Routing:Edit
---

# Luna Email Routing — Free Email for Every Product

Set up professional email addresses on any domain without paying for email hosting. Uses Cloudflare Email Routing (free) to forward to your real inbox.

## How It Works

```
hello@myproduct.ai  →  Cloudflare Email Routing  →  info@finsavvyai.com
support@myproduct.ai →  (same, free, instant)    →  info@finsavvyai.com
team@myproduct.ai   →  (same, free, instant)    →  info@finsavvyai.com
```

No mail server. No MX hosting. No monthly fees. Just DNS records + Cloudflare.

## Usage

```bash
# Set up catch-all for one domain
/email-routing myapp.ai

# Set up specific addresses
/email-routing myapp.ai --addresses "hello,support,team"

# Set up ALL portfolio domains at once
/email-routing all

# Forward to different email
/email-routing myapp.ai --destination "me@gmail.com"
```

## What It Does

1. Checks if the domain is on Cloudflare
2. Enables Email Routing on the zone
3. Adds destination email (verifies once)
4. Creates catch-all rule or specific address routes
5. Verifies MX records are set correctly

## Supported Configurations

### Catch-all (default)
Every email to `*@domain.com` forwards to your destination.

### Specific Addresses
```bash
/email-routing myapp.ai --addresses "hello,support,team,sales,noreply"
```
Creates individual routes for each address.

### Multiple Destinations
```bash
/email-routing myapp.ai --addresses "support:support@team.com,sales:sales@team.com"
```

## Portfolio Domains

When using `all`, configures these domains:
- lunaos.ai, clawpipe.ai, coderail.dev, opensyber.cloud
- push-ci.dev, pipewarden.dev, queryflux.dev, qestro.dev
- finsavvyai.com

## Prerequisites

Uses Cloudflare Global API Key (required for email routing API):
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Scroll to **Global API Key** → **View** → copy
3. Set in `.env`:
   ```
   CLOUDFLARE_AUTH_EMAIL=your@email.com
   CLOUDFLARE_API_TOKEN_GLOBAL=your_global_key
   ```

## How It Runs

The command executes two Cloudflare API calls per domain:
1. `PUT /zones/{id}/email/routing/enable` — enables routing
2. `PUT /zones/{id}/email/routing/rules/catch_all` — forwards all to destination

## Script

Setup script: `scripts/setup-email-routing.sh`

```bash
# All domains at once
CLOUDFLARE_AUTH_EMAIL=your@email.com \
CLOUDFLARE_GLOBAL_KEY=xxx \
bash scripts/setup-email-routing.sh

# Or use the command
/email-routing all
/email-routing myapp.ai
```

## In Pipes

```bash
# Set up email then deploy
/pipe email-routing myapp.ai >> ship

# Full launch: domain + email + deploy + audit
/pipe email-routing myapp.ai >> deploy >> site-audit https://myapp.ai
```
