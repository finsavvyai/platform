# Twitter / X OAuth Setup — Qestro

**Time**: 10 minutes
**Console**: https://developer.twitter.com/en/portal/projects-and-apps
**Cost**: Free tier works (Essential access)
**Prerequisite**: Twitter/X account with phone number verified

---

## Step 0: Developer Account (Skip if You Already Have One)

1. Go to **https://developer.twitter.com**
2. Click **"Sign up"** (top right) → **"Free"** tier
3. Fill in the application:
   - What's your use case: **"Building tools for Twitter users"**
   - Describe your use case (250 chars):
     ```
     Qestro is an AI-powered testing automation platform. We use Twitter OAuth
     2.0 for social login so users can sign in with their existing Twitter
     account instead of creating a new password. No tweeting, no posting,
     no reading timelines — just authentication.
     ```
   - Will you make Twitter content available to government? **No**
   - Will you analyze Twitter data? **No**
4. Accept terms → verify email → access granted instantly

---

## Step 1: Create a Project

1. Click **"+ Create Project"** (not just an App)
2. Project name: `Qestro`
3. Use case: **"Making a bot"** (misleading name — this covers OAuth use cases too)
4. Project description:
   ```
   OAuth 2.0 social login for Qestro testing platform. Users sign in with
   Twitter to access their test projects and analytics dashboards.
   ```

---

## Step 2: Create an App Inside the Project

1. Inside the project → click **"New App"** or use the default app Twitter creates
2. App name: `Qestro Web` (must be globally unique — try `Qestro Web Auth` if taken)
3. Twitter auto-generates API Key, API Secret, Bearer Token → you can IGNORE these (they're for OAuth 1.0a, we use 2.0)

---

## Step 3: Configure User Authentication (the critical step)

1. On the app dashboard → scroll to **"User authentication settings"**
2. Click the **gear icon** or **"Set up"** button
3. Fill in ALL of these fields:

### App permissions
- [x] **Read** (for reading user profile on login)
- [ ] Read and write (don't need — we're not tweeting)
- [ ] Read, write, and Direct Messages (don't need)

### Type of App
- [ ] Native App
- [x] **Web App, Automated App or Bot**  ← MUST pick this for OAuth 2.0 with secret
- [ ] Single page App

This choice is critical. "Native App" means public client (no secret) which breaks Qestro's confidential flow.

### App info

| Field | Value |
|-------|-------|
| Callback URI / Redirect URL | `https://api.qestro.app/api/auth/twitter/callback` |
| Website URL | `https://qestro.app` |
| Organization name | `Qestro` |
| Organization URL | `https://qestro.app` |
| Terms of service | `https://qestro.app/terms` |
| Privacy policy | `https://qestro.app/privacy` |

Click **Save**.

---

## Step 4: Get OAuth 2.0 Credentials

After saving user auth settings, you'll see a modal with:
- **OAuth 2.0 Client ID** — copy immediately
- **OAuth 2.0 Client Secret** — copy immediately (only shown once)

If you miss it, go to **Keys and tokens** tab → scroll to **"OAuth 2.0 Client ID and Client Secret"** → click **"Regenerate"** → copy.

### Keys and Tokens Tab Structure (for reference)

You'll see FOUR sets of credentials. You only need #4:
1. **API Key and Secret** (OAuth 1.0a — ignore)
2. **Bearer Token** (App-only auth — ignore)
3. **Access Token and Secret** (User-specific OAuth 1.0a — ignore)
4. **OAuth 2.0 Client ID and Client Secret** ← THIS ONE

---

## Step 5: App Details (Optional but Recommended)

### Description (shown on OAuth consent screen)
```
Qestro — AI-powered testing automation. Sign in with X to access your
test projects.
```

### App logo
Upload 400x400 PNG.

### Category
`Productivity`

---

## After Creation

### Deploy:
```bash
cd /Users/shaharsolomon/dev/projects/portfolio/qestro

npx wrangler secret put TWITTER_OAUTH_CLIENT_ID
# paste OAuth 2.0 Client ID (not API Key!)

npx wrangler secret put TWITTER_OAUTH_CLIENT_SECRET
# paste OAuth 2.0 Client Secret (not API Secret!)
```

### Verify:
```bash
curl -sI https://api.qestro.app/api/auth/twitter | head -3
# Expect: HTTP/2 302 with Location: https://twitter.com/i/oauth2/authorize?...code_challenge_method=S256...
```

The `code_challenge_method=S256` in the Location header confirms PKCE is active — Twitter requires it for OAuth 2.0.

---

## Email Access (Special Process)

**Twitter does NOT return email by default** even with the `email` scope. To get email access:

1. Go to your app → **"App details"** → scroll down
2. Find **"Request email from users"** → click **"Request access"**
3. Fill in additional application explaining why you need email
4. **Manual review** — takes 1-7 days
5. Until approved, `extractUser()` in Qestro returns empty email for Twitter users

Qestro's OAuth route handles empty email gracefully — the user gets logged in with a temporary email like `tw-{twitter_id}@placeholder.qestro.app` which you can prompt them to update in settings.

---

## Rate Limits (Essential Tier)

| Endpoint | Limit |
|----------|-------|
| OAuth 2.0 token exchange | 300 requests / 15 min |
| `GET /2/users/me` | 75 requests / 15 min per user |
| Bearer token | 450 requests / 15 min |

Plenty for login flows. You'll hit these only if you're building a Twitter scraper.

---

## Gotchas

1. **Picking "Native App" instead of "Web App"** — Breaks OAuth 2.0 confidential flow. Must be "Web App, Automated App or Bot".

2. **Using API Key instead of Client ID** — API Key (OAuth 1.0a) and Client ID (OAuth 2.0) are different. Qestro needs the Client ID. They're in different sections of the Keys and Tokens tab.

3. **No email returned** — Expected behavior. See "Email Access" section above.

4. **Free tier attestation requirement** — Twitter added a "monthly attestation" in 2024 where you must log into the dev portal every 30 days or your app gets suspended. Set a calendar reminder.

5. **PKCE is REQUIRED** — Twitter OAuth 2.0 requires PKCE (S256). Qestro sends it by default. If you see "PKCE is required" errors, something is broken in the `pkce.ts` module.

6. **Callback URL is case-sensitive** — `https://api.qestro.app/api/auth/twitter/callback` (lowercase) must match exactly. `Twitter` capitalized would fail.
