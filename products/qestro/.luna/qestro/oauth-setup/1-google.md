# Google OAuth Setup — Qestro

**Time**: 5 minutes
**Console**: https://console.cloud.google.com/apis/credentials
**Cost**: Free

---

## Copy-Paste Content

### OAuth Consent Screen Fields

| Field | Value |
|-------|-------|
| User type | **External** |
| App name | `Qestro` |
| User support email | `support@qestro.app` (or your personal email) |
| App logo | Upload from `public/icon-512.png` (must be 120x120 min) |
| App domain | `qestro.app` |
| Authorized domain | `qestro.app` |
| Application home page | `https://qestro.app` |
| Application privacy policy link | `https://qestro.app/privacy` |
| Application terms of service link | `https://qestro.app/terms` |
| Developer contact email | `info@finsavvyai.com` |

### App Description (for consent screen)
```
Qestro is an AI-powered testing platform that helps teams write, run, and
maintain automated tests across browsers, mobile devices, and APIs. Sign
in with Google to access your test suites, view analytics, and manage
your projects.
```

### Scopes to Select
On the "Scopes" step, add these non-sensitive scopes:
- `.../auth/userinfo.email` (See your primary email)
- `.../auth/userinfo.profile` (See your personal info)
- `openid`

**Do not** add any sensitive scopes (Gmail, Drive, etc.) — Qestro doesn't need them.

### Test Users (if staying in Testing mode)
Add your own email + any team member emails. You can publish the app later without review since only basic scopes are used.

---

## OAuth Client ID Fields

| Field | Value |
|-------|-------|
| Application type | **Web application** |
| Name | `Qestro Production` |
| Authorized JavaScript origins | `https://qestro.app`<br>`http://localhost:3000` |
| Authorized redirect URIs | `https://api.qestro.app/api/auth/google/callback`<br>`http://localhost:8787/api/auth/google/callback` |

---

## After Creation

Copy **Client ID** and **Client secret** from the credentials page.

### Deploy:
```bash
cd /Users/shaharsolomon/dev/projects/portfolio/qestro
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
# paste Client ID

npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
# paste Client secret
```

### Verify:
```bash
curl -sI https://api.qestro.app/api/auth/google | head -3
# Expect: HTTP/2 302 with Location: https://accounts.google.com/...
```

---

## Gotchas

1. **"Access blocked: Qestro has not completed the Google verification process"** — This happens in Production mode with unverified apps. Stay in Testing mode with test users added, OR submit for verification (takes 4-6 weeks, only needed for >100 users).

2. **Logo must be square** — Google rejects non-square logos silently. Resize to 512x512 before upload.

3. **Privacy policy MUST be live** — Google verifies the URL returns 200. If `https://qestro.app/privacy` is a 404, verification fails.
