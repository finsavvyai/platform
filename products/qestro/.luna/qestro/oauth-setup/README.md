# Qestro OAuth Setup — Master Guide

**Total time**: ~32 minutes for all 5 providers
**Cost**: $0 (all free tiers)
**Output**: 5 fully working OAuth providers on qestro.app

---

## Recommended Order

Follow these in this order — each builds confidence for the next. The whole sequence takes 30-40 minutes.

| # | Provider | Time | File | Why This Order |
|---|----------|------|------|----------------|
| 1 | **Google** | 5 min | [1-google.md](./1-google.md) | Easiest full OAuth flow — great confidence builder |
| 2 | **Discord** | 3 min | [4-discord.md](./4-discord.md) | Fastest of all — 3 fields and done |
| 3 | **Microsoft** | 8 min | [2-microsoft.md](./2-microsoft.md) | Most fields but straightforward once you know where to click |
| 4 | **LinkedIn** | 6 min | [3-linkedin.md](./3-linkedin.md) | Has the "hidden Products tab" gotcha but recoverable |
| 5 | **Twitter/X** | 10 min | [5-twitter.md](./5-twitter.md) | Most confusing UI — save for last |

**Note**: Apple Sign-In is intentionally skipped (requires $99/year developer account + JWT generation). See the auth-setup-guide.html for Apple steps if you decide to add it later.

---

## What You Need Before Starting

### Content Assets
- [ ] Logo at 512x512 PNG (`public/icon-512.png` or similar)
- [ ] Logo at 240x240 PNG (Microsoft variant)
- [ ] Logo at 100x100 PNG (LinkedIn variant)
- [ ] Logo at 300x300 PNG (LinkedIn company page)

### Pages That Must Return HTTP 200
- [ ] `https://qestro.app/privacy` — Privacy policy (required by Google, Microsoft, LinkedIn, Discord, Twitter)
- [ ] `https://qestro.app/terms` — Terms of service (required by same)
- [ ] `https://qestro.app` — Home page (required by all)

### Accounts
- [ ] Google account (for Google Cloud Console)
- [ ] Microsoft account OR Azure subscription (free tier works)
- [ ] LinkedIn account + company page (create for free)
- [ ] Discord account
- [ ] Twitter/X account with phone verified

### Development Environment
- [ ] `wrangler` CLI authenticated (`npx wrangler whoami` returns your email)
- [ ] Backend deployed to `api.qestro.app` (already done)
- [ ] Frontend deployed to `qestro.app` (already done)

---

## Universal Info

### Production Callback URLs
```
https://api.qestro.app/api/auth/google/callback
https://api.qestro.app/api/auth/microsoft/callback
https://api.qestro.app/api/auth/linkedin/callback
https://api.qestro.app/api/auth/discord/callback
https://api.qestro.app/api/auth/twitter/callback
```

### Development Callback URLs
```
http://localhost:8787/api/auth/google/callback
http://localhost:8787/api/auth/microsoft/callback
http://localhost:8787/api/auth/linkedin/callback
http://localhost:8787/api/auth/discord/callback
http://localhost:8787/api/auth/twitter/callback
```

---

## Brand Assets

Use these consistently across all providers to build brand recognition:

### Product Info
- **Name**: Qestro
- **Tagline**: The copilot for testing AI vibe coding
- **Category**: Software Development / Testing / AI
- **Website**: https://qestro.app
- **Support Email**: support@qestro.app
- **Contact Email**: info@finsavvyai.com

### Short Description (for OAuth consent screens)
```
Qestro is an AI-powered testing platform that helps teams write, run, and
maintain automated tests across browsers, mobile devices, and APIs. Sign
in to access your test suites, view analytics, and manage your projects.
```
**Character count**: 223

### Very Short Description (Discord — 180 char max)
```
Qestro — AI-powered testing automation platform. Sign in with Discord
to access your test suites, team projects, and CI/CD integrations.
```
**Character count**: 138

### Tags/Keywords (for all providers)
`testing`, `automation`, `ai`, `developer-tools`, `playwright`, `qa`, `ci-cd`, `productivity`

---

## After Each Provider

1. **Copy credentials immediately** — most providers show secrets only once
2. **Run `wrangler secret put`** commands from the provider's setup guide
3. **Verify with curl** — the setup guide has the exact verification command
4. **Test in browser** — click the provider's button on https://qestro.app/login

---

## Verification All At Once

After setting up all 5 providers, run this to test everything:

```bash
#!/bin/bash
echo "=== Qestro OAuth Provider Status ==="
for p in google microsoft linkedin discord twitter github; do
  status=$(curl -sIo /dev/null -w "%{http_code}" "https://api.qestro.app/api/auth/$p")
  if [ "$status" = "302" ]; then
    echo "✓ $p — OK (redirects to provider)"
  elif [ "$status" = "503" ]; then
    echo "✗ $p — NOT CONFIGURED (secrets missing)"
  else
    echo "? $p — HTTP $status"
  fi
done
```

### Or check the provider discovery endpoint:
```bash
curl -s https://api.qestro.app/api/auth/providers | jq '.providers | map(.id)'
```

Expected output (all providers enabled):
```json
["google", "github", "microsoft", "linkedin", "discord", "twitter", "email"]
```

---

## Troubleshooting Common Errors

| Error | Provider | Cause | Fix |
|-------|----------|-------|-----|
| `redirect_uri_mismatch` | All | Callback URL doesn't match exactly | Check trailing slashes, http vs https, port numbers |
| `invalid_client` | All | Wrong Client ID or Secret | Re-copy from provider console, re-run `wrangler secret put` |
| `Access blocked: Qestro has not completed the Google verification process` | Google | App in Production mode but unverified | Stay in Testing mode + add test users |
| `AADSTS700016: Application not found in directory` | Microsoft | Wrong tenant ID | Set `AZURE_TENANT_ID=common` for multi-tenant |
| `Scope authorization not granted` | LinkedIn | Forgot to request the "Sign In with LinkedIn using OpenID Connect" product | Go to Products tab, request access |
| `invalid_request: PKCE is required` | Twitter | App type set to "Native App" instead of "Web App" | User authentication settings → change Type of App |
| No email in user info | Twitter | Email permission not requested/approved | Submit "Request email from users" (1-7 day review) |
| `CORS error on /api/auth/*` | All | OAuth flows are 302 redirects, not AJAX | Use `window.location.href`, not `fetch()` |

---

## Cost Summary

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Google | Unlimited | Basic scopes don't require verification |
| Microsoft | Unlimited | Free Azure subscription required |
| LinkedIn | 500 req/day | Plenty for login |
| Discord | Unlimited | No rate limit on OAuth |
| Twitter | 300/15min | Essential tier (free) |
| **Total** | **$0/month** | All free tiers |

---

## Related Files

- `.luna/qestro/auth/auth-setup-guide.html` — Visual HTML guide with copy buttons
- `.luna/qestro/auth/auth-report.md` — Technical implementation report
- `.luna/qestro/auth/linkedin-company-page.md` — LinkedIn page content
- `.luna/qestro/auth/logo-prompt.md` — AI logo generation prompts
- `backend/src/auth/oauth-providers.ts` — Backend provider registry
- `frontend/src/stores/authStore.ts` — Frontend OAuth redirect logic
