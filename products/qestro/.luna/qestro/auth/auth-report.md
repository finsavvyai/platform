# Qestro Auth System — Implementation Report

**Generated**: 2026-04-09
**Status**: Complete — 7 OAuth providers + RBAC + PKCE

---

## Architecture

Qestro uses a **custom JWT auth system** (not Auth.js/NextAuth) because the frontend is React + Vite, not Next.js. The backend runs on Cloudflare Workers (Hono) with an Express fallback.

### Auth Stack
- **JWT tokens**: Access (24h) + Refresh (7d), signed with `JWT_SECRET`
- **OAuth**: 7 social providers via unified registry
- **PKCE**: S256 code challenge on all OAuth flows
- **RBAC**: 6 roles, 9 resources, 6 actions = full permission matrix
- **State management**: Frontend uses Zustand with localStorage persistence

### Components
| Layer | File | Purpose |
|-------|------|---------|
| Provider Registry | `auth/oauth-providers.ts` | Unified 7-provider config |
| PKCE | `auth/pkce.ts` | Code verifier/challenge generation |
| RBAC | `auth/rbac.ts` | Permission matrix + middleware |
| OAuth Routes (Hono) | `routes/oauth.route.ts` | All 7 providers via loop |
| Auth Routes (Express) | `routes/auth.routes.ts` | Register, login, refresh, password reset |
| Auth Routes (Hono) | `routes/auth.route.ts` | Workers-compatible auth |
| Express OAuth | `services/OAuthService.ts` | Express OAuth service (legacy) |
| Auth Middleware | `middleware/authMiddleware.ts` | @finsavvyai/auth JWT + DB validation |
| Frontend Store | `stores/authStore.ts` | Zustand auth state |
| Frontend Login | `pages/LoginPage.tsx` | 7-provider OAuth buttons |
| Schema | `schema/index.ts` | users, oauthAccounts tables |

---

## OAuth Providers (7 total)

| Provider | Status | Callback URL | Scopes |
|----------|--------|-------------|--------|
| Google | Ready | `/api/auth/google/callback` | openid, email, profile |
| GitHub | Ready | `/api/auth/github/callback` | user:email, read:user |
| Microsoft | Ready | `/api/auth/microsoft/callback` | openid, profile, email, User.Read |
| LinkedIn | **NEW** | `/api/auth/linkedin/callback` | openid, profile, email |
| Apple | **NEW** | `/api/auth/apple/callback` | name, email |
| Discord | **NEW** | `/api/auth/discord/callback` | identify, email |
| Twitter/X | **NEW** | `/api/auth/twitter/callback` | users.read, tweet.read |

### Production Base: `https://api.qestro.app/api/auth`
### Development Base: `http://localhost:8787/api/auth`

---

## RBAC Permission Matrix

| Resource | admin | manager | developer | tester | user | viewer |
|----------|-------|---------|-----------|--------|------|--------|
| projects:create | Y | Y | | | | |
| projects:read | Y | Y | Y | Y | Y | Y |
| projects:update | Y | Y | Y | | | |
| projects:delete | Y | | | | | |
| tests:create | Y | Y | Y | Y | | |
| tests:execute | Y | Y | Y | Y | Y | |
| tests:delete | Y | Y | | | | |
| runs:export | Y | Y | Y | Y | | |
| analytics:read | Y | Y | Y | Y | Y | Y |
| settings:update | Y | | | | | |
| billing:update | Y | | | | | |
| team:manage | Y | Y | | | | |
| ai:execute | Y | Y | Y | Y | | |
| integrations:update | Y | Y | | | | |

---

## Security Improvements

### Added in this build:
1. **PKCE on all OAuth flows** — S256 code challenge prevents authorization code interception
2. **Unified provider registry** — single source of truth eliminates config drift between Express/Hono stacks
3. **State parameter validation** — CSRF protection with UUID state + TTL + one-time-use
4. **RBAC middleware** — `requirePermission()` and `requireMinRole()` for route protection
5. **Role hierarchy** — `isRoleAtLeast()` checks (admin > manager > developer > tester > user > viewer)

### Previously implemented:
- JWT with separate access/refresh tokens
- Password hashing with bcryptjs (12 rounds)
- Rate limiting on auth endpoints
- Email enumeration protection on forgot-password
- OAuth account linking (multiple providers per email)
- Auth middleware with DB user validation (@finsavvyai/auth)

### Still recommended:
- [ ] Migrate PKCE state store from in-memory to KV (for multi-instance Workers)
- [ ] Add MFA/2FA support (TOTP)
- [ ] Implement session revocation via DB blacklist
- [ ] Add OAuth account connection management UI
- [ ] Rate limit OAuth callback endpoints

---

## Files Created / Modified

### New files:
| File | Purpose | Lines |
|------|---------|-------|
| `backend/src/auth/oauth-providers.ts` | Unified 7-provider registry with configs, extractors, icons | ~200 |
| `backend/src/auth/pkce.ts` | PKCE code verifier/challenge generation (Web Crypto) | ~50 |
| `backend/src/auth/rbac.ts` | RBAC permission matrix + middleware factories | ~160 |
| `.luna/qestro/auth/auth-setup-guide.html` | Standalone HTML setup guide for all 7 providers | ~800 |
| `.luna/qestro/auth/linkedin-company-page.md` | LinkedIn company page content | ~100 |
| `.luna/qestro/auth/logo-prompt.md` | AI logo generation prompts (DALL-E, Midjourney) | ~50 |

### Modified files:
| File | Change |
|------|--------|
| `backend/src/routes/oauth.route.ts` | Rewritten: 3 duplicated providers -> unified loop over 7 with PKCE |
| `frontend/src/pages/LoginPage.tsx` | 2-button grid -> 7-provider layout (3 prominent + 4 secondary) |
| `.env` | Added 14 OAuth env vars + developer console URLs as comments |

---

## How to Add a New Provider

1. Add entry to `OAUTH_PROVIDERS` in `backend/src/auth/oauth-providers.ts`
2. Add env vars to `.env` and Cloudflare Workers secrets
3. Add button to `OAUTH_PROVIDERS` array in `frontend/src/pages/LoginPage.tsx`
4. No route changes needed — the generic loop auto-registers routes

---

## Next Steps

1. **Set up provider credentials** — follow `auth-setup-guide.html`
2. **Deploy secrets**: `wrangler secret put GOOGLE_OAUTH_CLIENT_ID` (for each var)
3. **Test flows**: Visit `/api/auth/{provider}` to initiate each OAuth flow
4. **Apply RBAC**: Import `requirePermission('tests:create')` in route files
5. **Create LinkedIn page** — use content from `linkedin-company-page.md`
