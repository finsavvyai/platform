# Discord OAuth Setup — Qestro

**Time**: 3 minutes (fastest provider)
**Console**: https://discord.com/developers/applications
**Cost**: Free

---

## Copy-Paste Content

### Application Creation
| Field | Value |
|-------|-------|
| Name | `Qestro` |
| Team (optional) | Leave as "Personal" or assign to a Discord team |
| Check legal | Yes |

---

## General Information Tab

### App Icon
Upload 512x512 PNG (same as Google logo — reuse it).

### Description (shown on Discord OAuth consent screen)
```
Qestro — AI-powered testing automation platform. Sign in with Discord
to access your test suites, team projects, and CI/CD integrations.
```
(180 char max — the text above is 169 chars ✓)

### Tags (max 5)
- `Productivity`
- `Developer Tools`
- `Testing`
- `Automation`
- `Utility`

### Install Link
Select **"None"** (we only want OAuth, not bot installation)

### Terms of Service URL
```
https://qestro.app/terms
```

### Privacy Policy URL
```
https://qestro.app/privacy
```

---

## OAuth2 Tab

### General OAuth2 Settings

**Client ID** — copy from top of page (public, no need to hide)

**Client Secret** — click **"Reset Secret"** → **"Yes, do it!"** → **copy immediately** (only shown once per reset)

### Redirects (click "Add Redirect"):
```
https://api.qestro.app/api/auth/discord/callback
http://localhost:8787/api/auth/discord/callback
```
Click **"Save Changes"** at the bottom of the page (Discord's save is at the bottom, easy to miss).

### Default Authorization Link (optional — leave blank)
Don't configure this. Qestro constructs the authorization URL dynamically with PKCE.

---

## OAuth2 Scopes (for reference — don't configure here)

Discord scopes are passed at runtime, not configured in the dashboard. Qestro requests:
- `identify` — user ID, username, avatar, discriminator
- `email` — user's verified email

You do NOT need to enable these scopes in the dashboard. They're standard and always available.

---

## Bot Tab (IMPORTANT — do NOT configure)

**Skip this tab entirely.** Qestro uses OAuth2 only, not a bot. If you accidentally add a bot, delete it:
- Bot tab → scroll down → **"Delete Bot"** → confirm

Having an inactive bot is fine (doesn't break OAuth), but removes clutter.

---

## After Creation

### Deploy:
```bash
cd /Users/shaharsolomon/dev/projects/portfolio/qestro

# From top of OAuth2 tab
npx wrangler secret put DISCORD_OAUTH_CLIENT_ID

# From the reset in step above
npx wrangler secret put DISCORD_OAUTH_CLIENT_SECRET
```

### Verify:
```bash
curl -sI https://api.qestro.app/api/auth/discord | head -3
# Expect: HTTP/2 302 with Location: https://discord.com/api/oauth2/authorize...
```

---

## What Users See

When someone clicks "Sign in with Discord" on qestro.app:
1. Redirected to Discord's OAuth consent page
2. Shows "Qestro wants to access your account" + your logo + description
3. Lists the scopes: "Read your username, avatar, and email address"
4. User clicks "Authorize"
5. Redirected back to `api.qestro.app/api/auth/discord/callback` with a code
6. Qestro exchanges code for user info, creates session, redirects to dashboard

---

## Gotchas

1. **Forget to click "Save Changes"** — Discord's save button is at the bottom of the OAuth2 page. If you add redirects but don't scroll down to save, they're lost.

2. **Client Secret reset invalidates old one** — If you click "Reset Secret" after deploying, all existing sessions break. Only reset if you're rotating credentials intentionally.

3. **No email returned** — If a Discord user hasn't verified their email, the `email` field comes back as `null`. Qestro's extractor handles this but you should require email verification in your signup flow.

4. **Rate limits** — Discord OAuth token endpoint: 10 requests/min per client. Plenty for login, not enough for abuse.
