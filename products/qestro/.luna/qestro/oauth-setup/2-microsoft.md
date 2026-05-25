# Microsoft / Azure AD OAuth Setup — Qestro

**Time**: 8 minutes
**Console**: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
**Cost**: Free (free Azure tenant works)

---

## Copy-Paste Content

### App Registration Fields

| Field | Value |
|-------|-------|
| Name | `Qestro` |
| Supported account types | **Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)** |
| Redirect URI - Platform | **Web** |
| Redirect URI - URI | `https://api.qestro.app/api/auth/microsoft/callback` |

---

## Branding & Properties (Left sidebar → Branding & properties)

| Field | Value |
|-------|-------|
| Name | `Qestro` |
| Logo | Upload 240x240 PNG (use `public/logo-240.png`) |
| Home page URL | `https://qestro.app` |
| Terms of service URL | `https://qestro.app/terms` |
| Privacy statement URL | `https://qestro.app/privacy` |
| Publisher domain | `qestro.app` (must be verified — click "Verify a domain" if needed) |
| Internal notes | `Qestro production OAuth app — social login` |

---

## Authentication Settings (Left sidebar → Authentication)

### Web redirect URIs (add all 3):
```
https://api.qestro.app/api/auth/microsoft/callback
http://localhost:8787/api/auth/microsoft/callback
http://localhost:3000/auth/sso/callback
```

### Implicit grant and hybrid flows:
- [x] **ID tokens (used for implicit and hybrid flows)**
- [ ] Access tokens (leave unchecked — we use authorization code flow)

### Supported account types:
- [x] **Accounts in any organizational directory... and personal Microsoft accounts**

### Advanced settings:
- Allow public client flows: **No**
- Live SDK support: **Yes**

---

## API Permissions (Left sidebar → API permissions)

Default permissions should already include `User.Read` (Microsoft Graph, Delegated).

If not, click **Add a permission** → **Microsoft Graph** → **Delegated permissions** → search and add:
- `openid`
- `profile`
- `email`
- `User.Read`

Click **Grant admin consent for [Tenant]** (if you're an admin).

---

## Certificates & Secrets (Left sidebar)

1. Click **Client secrets** tab → **+ New client secret**
2. Description: `qestro-production-180d`
3. Expires: **730 days (24 months — max)**
4. Click **Add**
5. **IMMEDIATELY copy the "Value" column** — it's only shown once, never again
6. Do NOT copy "Secret ID" — that's not the secret

---

## Token Configuration (Optional but recommended)

Left sidebar → **Token configuration** → **+ Add optional claim** → **ID** → check:
- `email`
- `family_name`
- `given_name`
- `preferred_username`

Click Add → "Turn on Microsoft Graph email, profile permission (required for claims to appear in token)" → Add.

---

## After Creation

### Deploy:
```bash
cd /Users/shaharsolomon/dev/projects/portfolio/qestro

# From Overview page — "Application (client) ID"
npx wrangler secret put AZURE_OAUTH_CLIENT_ID

# From step 5 above — the Value column
npx wrangler secret put AZURE_OAUTH_CLIENT_SECRET

# Use "common" for multi-tenant (both work/school + personal accounts)
npx wrangler secret put AZURE_TENANT_ID
# type: common
```

### Verify:
```bash
curl -sI https://api.qestro.app/api/auth/microsoft | head -3
# Expect: HTTP/2 302 with Location: https://login.microsoftonline.com/...
```

---

## Publisher Verification (Optional — removes "unverified app" warning)

1. Go to **Branding & properties**
2. Click **"Add MPN ID to verify publisher"**
3. Requires a Microsoft Partner Network ID (free to get)
4. Without this, users see "This app has not been verified by Microsoft" on the consent screen — still works, just looks less trustworthy

---

## Gotchas

1. **Tenant ID "common" vs specific** — Use `common` for consumer apps (anyone with a Microsoft account). Use your tenant GUID if you want to restrict to employees of one org only.

2. **Secret value vs Secret ID** — Devs routinely copy the wrong column. The "Value" column is 40 random chars. The "Secret ID" is a GUID — that's NOT what you need.

3. **Client secret expires in 24 months max** — Put a calendar reminder. When it expires, OAuth silently fails with "invalid_client" and users can't sign in. Rotate 2 weeks before expiry.

4. **Personal Microsoft accounts need specific settings** — If you picked single-tenant, personal accounts (Outlook, Hotmail, Live) can't sign in. Must be multi-tenant.
