---
name: ll-365-secure
displayName: Luna Microsoft 365 Security
description: Apply Microsoft 365 / Azure AD security hardening and BFF session authentication
version: 1.0.0
category: security
agent: luna-365-security
parameters:
  - name: scope
    type: string
    description: Project or feature scope for security hardening
    required: true
    prompt: true
workflow:
  - audit_current_auth_flow
  - implement_bff_session_exchange
  - apply_security_headers
  - configure_rate_limiting
  - validate_jwt_verification
  - generate_security_report
output:
  - .luna/{current-project}/security-report.md
  - src/lib/server/session-store.server.ts
  - src/routes/auth/session/+server.ts
  - src/hooks.server.ts (updated)
prerequisites:
  - existing_authentication_flow (MSAL.js / Azure AD)
  - .luna/{current-project}/requirements.md
---

# Luna Microsoft 365 Security

Applies enterprise-grade Microsoft 365 / Azure AD security hardening and BFF session authentication to your application. Based on the `365-security` and `bff-session-auth` skill protocols.

**Zero Azure Entra changes required.**

## What This Command Does

This command audits your current authentication flow, implements the BFF (Backend-for-Frontend) session exchange pattern, applies strict security headers, configures rate limiting, and validates JWT verification — all following Microsoft 365 best practices.

## Prerequisites

Requires:
- An existing authentication flow using MSAL.js v2+ (Auth Code + PKCE)
- Node.js `crypto` module available
- `.luna/{current-project}/requirements.md`

If you don't have authentication set up yet, first run:
```
/luna-execute  # With auth setup task in your plan
```

## Execution Steps

### 1. Audit Current Auth Flow
- Verify Auth Code + PKCE is in use (not Implicit Flow)
- Check `cacheLocation` is `sessionStorage` (not `localStorage`)
- Ensure tokens never appear in URL fragments
- Flag any use of `localStorage` for token storage

### 2. Implement BFF Session Exchange
Creates server-side session management:

```
Login Flow:
  MSAL.js → acquireTokenSilent → token (in JS for ~2 seconds)
  Browser → POST /auth/session { token }
  BFF → validates JWT → generates 256-bit session ID
  BFF → stores { sessionId → accessToken, user, fingerprint }
  BFF → Set-Cookie: __session=<id>; HttpOnly; Secure; SameSite=Strict
  Browser → clears MSAL sessionStorage
```

**Files Created:**
- `src/lib/server/session-store.server.ts` — Server-side session store
- `src/routes/auth/session/+server.ts` — Session API endpoint (POST/GET/DELETE)

**Session Security Properties:**
| Property | Implementation |
|----------|---------------|
| Session ID entropy | 256 bits (`crypto.randomBytes(32)`) |
| Session fixation | ID created only after JWT validation |
| Cookie flags | `HttpOnly; Secure; SameSite=Strict; Path=/` |
| Fingerprint binding | `SHA-256(User-Agent + IP)` validated every request |
| Sliding TTL | 75 min, refreshed on each request |
| Absolute expiry | 8 hours hard cap |

### 3. Apply Security Headers
Updates `hooks.server.ts` with:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-XSS-Protection` | `0` (disabled in favor of CSP) |
| `Content-Security-Policy` | strict `script-src` |

### 4. Configure Rate Limiting
- General API: 100 req/min per IP
- Auth endpoints: 10 req/min per IP (OTP, login, session exchange)
- Sliding window with periodic cleanup of stale buckets

### 5. Validate JWT Verification
Ensures server-side JWT validation covers:
- **Signature** via JWKS endpoint
- **Audience** (`aud` claim)
- **Issuer** (`iss` — both v1 and v2 formats)
- **Expiration** (`exp` with 30s clock skew tolerance)

Issuer formats accepted:
- v2: `https://login.microsoftonline.com/{tenant}/v2.0`
- v1: `https://sts.windows.net/{tenant}/`

### 6. Generate Security Report
Creates `.luna/{current-project}/security-report.md` with:
- Checklist of all security measures applied
- Attack vectors covered (XSS, CSRF, AiTM, token replay)
- Remaining Azure Portal tasks (Conditional Access, FIDO2, etc.)
- Testing checklist for verification

## Attack Vectors Covered

| Attack | Defense |
|--------|---------|
| XSS → token theft | BFF session exchange (HTTP-only cookies) |
| AiTM phishing | FIDO2 keys (Azure Portal) |
| Device code abuse | Restrict device code flow (Azure Portal) |
| Token in logs | Never log tokens or HMAC payloads |
| Open proxy | Path allowlisting on all proxy routes |
| CSRF | `SameSite=Strict` + Origin validation |
| Brute force | Rate limiting on auth endpoints |
| Token replay | Client fingerprint binding, short TTL |

## Output Files

Creates in your current project:
```
.luna/{current-project}/security/
├── security-report.md           # Comprehensive audit report
src/lib/server/
├── session-store.server.ts      # BFF session store
src/routes/auth/session/
├── +server.ts                   # Session API endpoint
src/
├── hooks.server.ts              # Updated with security middleware
```

## Testing Checklist

After running this command, verify:
- [ ] Login → `__session` cookie set, `sessionStorage` empty
- [ ] API calls work with cookie auth (no Bearer header)
- [ ] `GET /auth/session` returns valid + TTL
- [ ] Logout → cookie cleared, server session destroyed
- [ ] Idle timeout → re-auth works
- [ ] Fingerprint mismatch (different User-Agent) → session rejected
- [ ] Session expiry → 401 → silent re-auth
- [ ] Multiple tabs → session shared via cookie

## Next Steps in Workflow

After security hardening, run tests:
```
/luna-test
```

Then proceed to deployment:
```
/luna-deploy
```

## Tips

- The in-memory session store is sufficient for internal dashboards. For user-facing apps, swap to Redis.
- The 2-second token window during initial auth is negligible risk vs. 8-hour `sessionStorage` exposure.
- Azure Portal tasks (Conditional Access, FIDO2) require admin access and are out-of-scope for this command.
- Run this command again after major auth changes to re-audit.
