# AI + Recording Ship Status

**Date**: 2026-04-14

## AI Integration

### Status: Code ready, secrets needed

| Component | State |
|-----------|-------|
| `/api/ai/generate-test` | Live, returns 200 |
| `/api/ai/analyze-failure` | Live, returns 200 |
| `AIProviderClient` (OpenAI + llamafile fallback) | Deployed |
| `AIService` (routing, caching, limits) | Deployed |
| OPENAI_API_KEY on `questro-backend` | **MISSING** |
| ANTHROPIC_API_KEY on `questro-backend` | **MISSING** |
| Response today | `[AI stub] Model gpt-3.5-turbo not configured` |

### To enable real AI:
```bash
cd backend
wrangler secret put OPENAI_API_KEY      # paste your sk-proj-... key
wrangler secret put ANTHROPIC_API_KEY   # paste your sk-ant-... key
# (optional) local offline AI:
wrangler secret put LOCAL_LLM_URL       # e.g. https://your-llamafile.example.com/v1
```

### Why the secrets are missing
The `qestro-api` Worker (deployed from root wrangler.toml) has OPENAI_API_KEY, but that Worker is NOT routed to `api.qestro.app`. The routed Worker is `questro-backend` (from `backend/wrangler.toml`) which only has GITHUB_OAUTH_CLIENT_ID/SECRET. Running `wrangler secret put` from `backend/` targets the correct worker.

### Verification after secret upload:
```bash
# Should return actual generated Playwright code, not stub
curl -sX POST https://api.qestro.app/api/ai/generate-test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Test login page","url":"https://qestro.app/login"}'
```

---

## Recording

### Status: UI works, real recording needs separate service

| Component | State |
|-----------|-------|
| `/recording-studio` frontend page | Live, renders UI |
| `/api/recordings/openclaw/sessions` (GET) | Live, returns mock sessions |
| `/api/recordings/openclaw/start` (POST) | Live, creates DB record but no real browser |
| `/api/recordings/openclaw/:id/stop` (POST) | Live |
| CF Workers running Playwright | **Not possible** — no persistent process |
| `playwright-service/` standalone | **Built, not deployed** |

### Architecture reality
Cloudflare Workers cannot run Playwright (requires persistent Node process + Chromium binary). The "recording" endpoints on the Worker return placeholder data. For real recording:

1. **`playwright-service/`** exists in the repo with a Dockerfile
2. Deploy it to a container host: Railway, Fly.io, Render, or EC2
3. Point `RECORDING_SERVICE_URL` env var at its URL
4. Worker endpoints proxy to the service instead of returning mocks

### Deploy playwright-service to Fly.io (15 min):
```bash
cd playwright-service
fly launch              # accepts Dockerfile
fly deploy
# Get URL, e.g. https://qestro-playwright.fly.dev
cd ../backend
wrangler secret put RECORDING_SERVICE_URL
# paste: https://qestro-playwright.fly.dev
```

### Alternative: Railway
```bash
cd playwright-service
railway up
railway domain          # generates public URL
```

### Workers + Playwright alternatives (easier but less flexible):
- **Browserbase** — managed Playwright SaaS, pay-as-you-go
- **Browserless.io** — similar, has Workers SDK
- **Puppeteer in Cloudflare Browser Rendering** — alpha, limited features

---

## What works RIGHT NOW without any secrets

These features are fully functional on the live site:

| Feature | Works? |
|---------|--------|
| Email signup + login | Yes |
| GitHub OAuth login | Yes |
| Dashboard | Yes (mock stats) |
| Test case CRUD | Yes |
| Test plan CRUD | Yes |
| Test run tracking | Yes |
| Cycles CRUD | Yes |
| Visual regression UI | Yes (captures if backend has Puppeteer) |
| Analytics dashboard | Yes (mock flaky data) |
| Settings | Yes |
| Billing (LemonSqueezy) | Yes |

## What needs ONE thing to work

| Feature | Needs |
|---------|-------|
| AI test generation | `wrangler secret put OPENAI_API_KEY` on questro-backend |
| AI bug analysis | Same |
| Self-healing suggestions | Same |
| 6 other OAuth logins | `wrangler secret put {PROVIDER}_OAUTH_CLIENT_ID/SECRET` per `.luna/qestro/oauth-setup/` |

## What needs deploy work

| Feature | Needs |
|---------|-------|
| Real browser recording | Deploy `playwright-service/` to Fly.io/Railway |
| Mobile recording | Deploy similar service with Appium + iOS/Android SDKs |
| Real visual regression captures | Puppeteer works in Workers via wrangler browser-rendering (alpha) |

---

## Bottom Line

**Shippable features**: Auth, project/test CRUD, dashboard, analytics UI, 1 OAuth provider.
**One-secret-away**: AI features (5 min of user action).
**Deploy-away**: Real recording (15-30 min of Fly.io/Railway setup).
