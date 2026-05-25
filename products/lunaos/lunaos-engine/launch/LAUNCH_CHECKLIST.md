# 🚀 LunaOS Launch Checklist

> **Target Date**: Tuesday, 12:01 AM PT
> **Status Page**: status.lunaos.ai (deploy pending)
> **Dashboard**: agents.lunaos.ai ✅
> **API**: api.lunaos.ai ✅

---

## Pre-Launch (T-48h)

### Infrastructure ✅
- [x] API deployed on Cloudflare Workers
- [x] Dashboard deployed on Cloudflare Pages
- [x] Docs deployed at docs.lunaos.ai
- [x] Marketing site at lunaos.ai
- [x] Sentry error tracking integrated (HTTP-based, no SDK)
- [x] Status page worker written (needs `wrangler deploy`)
- [x] Health check endpoint returning 200 with deep dependency checks
- [x] Metrics tracking (P50/P95/P99 per endpoint)
- [x] CORS hardened (lunaos.ai + localhost only)
- [x] Zod validation on all API endpoints
- [ ] Deploy status page: `cd lunaos-infra/status && npm install && wrangler deploy`
- [ ] Set Sentry DSN: `wrangler secret put SENTRY_DSN` in lunaos-engine
- [ ] Set alert secrets: `wrangler secret put RESEND_API_KEY` in status worker

### Product ✅
- [x] 28 AI agents operational
- [x] CLI (`@luna-agents/cli`) published with npx support
- [x] Multi-provider LLM (DeepSeek, Claude, GPT-4, Workers AI)
- [x] Agent chain pipelines
- [x] RAG semantic search
- [x] API key generation and management
- [x] Token tracking and cost estimation
- [x] Stripe billing integration

### Content ✅
- [x] Professional README with badges + 28-agent catalog
- [x] Product Hunt listing draft (see `launch/PRODUCT_HUNT.md`)
- [x] Social posts drafted (see `launch/SOCIAL_POSTS.md`)
- [x] Demo video script written (60-second flow)
- [x] Discord channel structure planned

---

## Launch Day (T-0)

### Before PH Goes Live
- [ ] Verify API health: `curl https://api.lunaos.ai/health`
- [ ] Verify CLI: `npx @luna-agents/cli run code-review --help`
- [ ] Check status page: all services green
- [ ] Check Sentry: no unresolved errors
- [ ] Submit PH listing (scheduling)
- [ ] Post first maker comment

### When PH Goes Live
- [ ] Post Twitter thread (7 tweets)
- [ ] Post LinkedIn article
- [ ] Monitor Sentry for error spikes
- [ ] Monitor status page for outages
- [ ] Watch signup funnel in dashboard

### Metrics to Watch
- Error rate: target < 1%
- P95 response time: target < 500ms
- Signup → first agent run: target < 5 minutes
- PH upvotes: target 100+ day 1

---

## Post-Launch (T+24h)

- [ ] Respond to all PH comments
- [ ] Fix any critical bugs (< 2h turnaround)
- [ ] Publish Dev.to article
- [ ] Send first changelog/newsletter
- [ ] Review signup analytics
- [ ] Gather top feature requests

---

## Assets Checklist

| Asset | Location | Status |
|:------|:---------|:------:|
| PH Copy | `launch/PRODUCT_HUNT.md` | ✅ |
| Social Posts | `launch/SOCIAL_POSTS.md` | ✅ |
| README | `luna-agents/README.md` | ✅ |
| Landing Demo | Browser recording | ✅ |
| Dashboard Demo | Browser recording | ✅ |
| Demo Video | Needs recording | 🔲 |
| PH Gallery Images | Need screenshots | 🔲 |

---

## Deployment Commands

```bash
# Deploy status page
cd lunaos-infra/status
npm install
wrangler deploy

# Set Sentry DSN on API
cd lunaos-engine/packages/api
wrangler secret put SENTRY_DSN

# Set alert email on status page
cd lunaos-infra/status
wrangler secret put RESEND_API_KEY
wrangler secret put ALERT_EMAIL

# Verify everything
curl -s https://api.lunaos.ai/health | python3 -m json.tool
curl -s https://status.lunaos.ai/api/status | python3 -m json.tool
npx @luna-agents/cli agents list
```
