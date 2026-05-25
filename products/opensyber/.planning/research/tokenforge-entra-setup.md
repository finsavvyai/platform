# TokenForge — Microsoft Entra ID setup plan

> **Prereqs met:** OpenSyber Entra app live (client `414212fb-3cee-44ec-99a4-c9ab3ee78b81`), publisher domain `opensyber.cloud` verified.
> **Tenant:** `infofinsavyai.onmicrosoft.com` (same as OpenSyber — reuse MPN once enrolled).
> **Blocker:** TokenForge currently only wires Google + GitHub. Needs `@opensyber/auth` shared provider builder to add Microsoft + LinkedIn.

## Phase 1 — Code prep (can land now, before Entra app exists)

### 1.1 Migrate `apps/tokenforge-web/src/lib/auth.ts` to shared `@opensyber/auth`

Current file hand-rolls Google + GitHub providers. Switch to `buildProviders` from `@opensyber/auth` so Microsoft + LinkedIn drop in by env var alone (same pattern as `apps/web/src/lib/auth.ts`).

```ts
import NextAuth from 'next-auth';
import { buildProviders, sharedCallbacks } from '@opensyber/auth';

const isProduction = process.env.NODE_ENV === 'production';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: buildProviders({
    google:    { clientId: process.env.GOOGLE_CLIENT_ID!,    clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    github:    { clientId: process.env.GITHUB_CLIENT_ID!,    clientSecret: process.env.GITHUB_CLIENT_SECRET! },
    linkedin:  { clientId: process.env.LINKEDIN_CLIENT_ID!,  clientSecret: process.env.LINKEDIN_CLIENT_SECRET! },
    microsoft: {
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    },
  }),
  pages: { signIn: '/sign-in' },
  callbacks: { ...sharedCallbacks, /* keep tokenforge apiKey/tenantId callbacks */ },
  cookies: isProduction ? { /* existing cookie config */ } : undefined,
});
```

**Preserve** the existing tokenforge-specific JWT callbacks that store `apiKey` + `tenantId` on the token. Compose them after `sharedCallbacks`.

### 1.2 Update sign-in buttons component

`apps/tokenforge-web/src/app/sign-in/[[...sign-in]]/page.tsx` currently hard-codes Google + GitHub buttons. Replace with `PROVIDER_BUTTONS` iteration from `@opensyber/auth` (same as OpenSyber's `SignInButtons.tsx`).

### 1.3 File-size budget

Both files well under the 200-line cap — no split needed.

## Phase 2 — Create Entra app registration

### 2.1 Portal click-path

https://entra.microsoft.com → **Identity → Applications → App registrations → + New registration**

| Field | Value |
|---|---|
| Name | `TokenForge` |
| Supported account types | **Any Entra ID Tenant + Personal Microsoft accounts** (same as OpenSyber) |
| Redirect URI | Web → `https://tokenforge.opensyber.cloud/api/auth/callback/microsoft-entra-id` |

Copy **Application (client) ID** — save as `TOKENFORGE_AZURE_AD_CLIENT_ID` in your notes.

### 2.2 Redirect URIs (Authentication blade)

Add all:
```
https://tokenforge.opensyber.cloud/api/auth/callback/microsoft-entra-id
http://localhost:3001/api/auth/callback/microsoft-entra-id   (dev only)
```

Front-channel logout:
```
https://tokenforge.opensyber.cloud/api/auth/signout
```

### 2.3 Branding & properties

| Field | Value |
|---|---|
| Display name | `TokenForge` |
| Logo | Upload `apps/tokenforge-web/public/brand/logo-mark-240.png` (create if missing — match TokenForge product mark, not OpenSyber crosshair) |
| Home page URL | `https://tokenforge.opensyber.cloud` |
| Terms of service URL | `https://tokenforge.opensyber.cloud/terms` |
| Privacy statement URL | `https://tokenforge.opensyber.cloud/privacy` |
| Service management reference | `https://tokenforge.opensyber.cloud/dashboard/admin` |
| Publisher domain | `opensyber.cloud` (already verified via OpenSyber — **no second DNS verify needed**, just enter domain and save) |

### 2.4 Publisher domain proof — add TokenForge to shared `microsoft-identity-association.json`

Both apps share `opensyber.cloud` root domain, so the existing file at `apps/web/public/.well-known/microsoft-identity-association.json` already proves publisher-domain ownership. Add the TokenForge application ID to the same array:

```json
{
  "associatedApplications": [
    { "applicationId": "414212fb-3cee-44ec-99a4-c9ab3ee78b81" },
    { "applicationId": "<TOKENFORGE_CLIENT_ID>" }
  ]
}
```

**Note:** the file is served from `opensyber.cloud` root, NOT from `tokenforge.opensyber.cloud`. Microsoft's publisher-domain validator fetches `https://opensyber.cloud/.well-known/microsoft-identity-association.json` regardless of which app is verifying — because publisher domain is `opensyber.cloud` for both apps. No duplicate file needed on the tokenforge subdomain.

### 2.5 API permissions + admin consent

Same as OpenSyber:
- `openid`
- `profile`
- `email`
- `offline_access`
- `User.Read`

Grant admin consent.

### 2.6 Token configuration

Add optional ID-token claims: `email`, `preferred_username`, `family_name`, `given_name`.

### 2.7 Client secret

New secret, description `tokenforge-prod-2026-04`, 24 months.
**Copy value immediately** — paste into wrangler in next step.

## Phase 3 — Cloudflare secrets

TokenForge worker separate from OpenSyber worker. Must set secrets independently:

```bash
cd apps/tokenforge-web

echo "<tokenforge-client-id>"   | npx wrangler secret put AZURE_AD_CLIENT_ID
echo "common"                    | npx wrangler secret put AZURE_AD_TENANT_ID
npx wrangler secret put AZURE_AD_CLIENT_SECRET    # paste value from Entra

# While here, also add LinkedIn secrets if not set:
npx wrangler secret put LINKEDIN_CLIENT_ID
npx wrangler secret put LINKEDIN_CLIENT_SECRET

# AUTH_SECRET should already be set
npx wrangler secret list | grep -iE "auth|linkedin|azure|google|github"
```

## Phase 4 — Deploy + verify

```bash
cd /Users/shaharsolomon/dev/projects/portfolio/opensyber
git commit -am "feat(tokenforge): add Microsoft + LinkedIn SSO via @opensyber/auth"
git push origin main
```

PushCI run full pipeline + deploy.

### Smoke test

Playwright: copy `apps/web/e2e/oauth-all-providers-smoke.spec.ts` → `apps/tokenforge-web/e2e/oauth-all-providers-smoke.spec.ts`, swap:
- baseURL → `https://tokenforge.opensyber.cloud`
- Microsoft client ID → new TokenForge client ID
- Callback paths → `tokenforge.opensyber.cloud/api/auth/callback/...`

Run headless to validate config.

## Phase 5 — MPN association (optional, does after Phase 4)

Once `@opensyber` MPN ID issued (see separate `mpn-partner-program.md`), add same MPN ID to TokenForge app — one click in Entra Branding blade. Both apps inherit "Verified Publisher" badge.

## Checklist

- [ ] Phase 1.1 — migrate auth.ts to shared buildProviders
- [ ] Phase 1.2 — sign-in buttons iterate PROVIDER_BUTTONS
- [ ] Phase 2.1 — create Entra app `TokenForge`
- [ ] Phase 2.2 — redirect URIs
- [ ] Phase 2.3 — branding fields + logo
- [ ] Phase 2.4 — add to shared well-known file
- [ ] Phase 2.5 — API permissions + admin consent
- [ ] Phase 2.6 — token optional claims
- [ ] Phase 2.7 — client secret + copy value
- [ ] Phase 3 — 3 wrangler secrets for tokenforge-web
- [ ] Phase 4 — deploy + Playwright smoke
- [ ] Phase 5 — MPN association (after OpenSyber path)
