# LinkedIn OAuth Setup — Qestro

**Time**: 6 minutes
**Console**: https://www.linkedin.com/developers/apps
**Cost**: Free
**Prerequisite**: Must have a LinkedIn Company Page (create free at linkedin.com/company/setup)

---

## LinkedIn Company Page (Create First If Missing)

### Company Page Content
| Field | Value |
|-------|-------|
| Name | `Qestro` |
| LinkedIn public URL | `linkedin.com/company/qestro` |
| Website | `https://qestro.app` |
| Industry | `Software Development` |
| Company size | `2-10 employees` |
| Company type | `Privately Held` |
| Logo | Upload 300x300 PNG |
| Tagline | `The copilot for testing AI vibe coding` |
| Description (About) | (use content from `.luna/qestro/auth/linkedin-company-page.md`) |

After creating the page, verify you're an admin (My Company → Admin tools → shows you as owner).

---

## App Creation Fields

| Field | Value |
|-------|-------|
| App name | `Qestro` |
| LinkedIn Page | Select the Qestro company page from dropdown |
| Privacy policy URL | `https://qestro.app/privacy` |
| App logo | Upload 100x100 PNG minimum |
| Legal agreement | Check the box |

---

## Products Tab (CRITICAL STEP)

This is where most devs get stuck. After creating the app, you **MUST** request product access:

1. Click the **"Products"** tab (next to Settings, Auth, Analytics)
2. Find **"Sign In with LinkedIn using OpenID Connect"**
3. Click **"Request access"**
4. Read the terms → check the box → **Submit**
5. **Access is instant** (no human review) — refresh the page to confirm it's under "Added products"

### Do NOT request these (you don't need them, and they DO require review):
- ❌ Share on LinkedIn
- ❌ Marketing Developer Platform
- ❌ Talent Solutions

---

## Auth Tab

### OAuth 2.0 Settings

**Authorized redirect URLs** (click the pencil icon to edit):
```
https://api.qestro.app/api/auth/linkedin/callback
http://localhost:8787/api/auth/linkedin/callback
```

### OAuth 2.0 Scopes (auto-granted after product approval):
- `openid`
- `profile`
- `email`

You should see these listed under "OAuth 2.0 scopes" after the product was approved.

### Application Credentials (at the top of the Auth tab)
- **Client ID** — copy this
- **Client Secret** — click **"Show"** → copy immediately

---

## Settings Tab

### App Info
| Field | Value |
|-------|-------|
| App description | `AI-powered testing automation platform. Sign in with LinkedIn to access your projects, view test analytics, and collaborate with your team.` |
| Business email | `info@finsavvyai.com` |
| Phone number | (optional) |

### App Admins
Add team members who need admin access to this LinkedIn app.

---

## After Creation

### Deploy:
```bash
cd /Users/shaharsolomon/dev/projects/portfolio/qestro

npx wrangler secret put LINKEDIN_OAUTH_CLIENT_ID
# paste Client ID

npx wrangler secret put LINKEDIN_OAUTH_CLIENT_SECRET
# paste Client Secret
```

### Verify:
```bash
curl -sI https://api.qestro.app/api/auth/linkedin | head -3
# Expect: HTTP/2 302 with Location: https://www.linkedin.com/oauth/v2/authorization...
```

---

## Verification Status

LinkedIn shows your app as "Unverified" unless you submit for review. For Qestro's use case (just social login, OIDC scopes), you do NOT need verification. The unverified badge only shows to LinkedIn admins, not end users.

---

## Gotchas

1. **"Scope not authorized" error** — You forgot to request the Sign In with LinkedIn product. Go back to the Products tab.

2. **Company page requirement** — You MUST own/admin a company page to create an app. Personal LinkedIn profile doesn't work.

3. **No email in response** — LinkedIn returns email via OIDC only if you requested `openid profile email` scopes (Qestro already does). If email is empty, the scope wasn't granted.

4. **Rate limits** — LinkedIn's free tier has 500 requests/day for `userinfo` endpoint. Plenty for auth, not enough for scraping.
