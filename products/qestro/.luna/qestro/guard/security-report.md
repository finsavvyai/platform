# Qestro Security Report

**Date**: 2026-04-10
**Scan Type**: Full (6 layers)
**Overall Risk**: MEDIUM (3 critical, 4 high, 6 medium findings)

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Needs immediate fix |
| HIGH | 4 | Fix before launch |
| MEDIUM | 6 | Fix in next sprint |
| LOW | 2 | Informational |

---

## CRITICAL Findings

### C1: `.env` files tracked in Git with real secrets
**Layer**: Secret Scanning
**Risk**: API keys and tokens committed to version control. Anyone with repo access can extract them.

**Evidence**:
- `backend/.env` — tracked, contains `LEMONSQUEEZY_API_KEY` (real JWT token)
- `frontend/.env` — tracked by Git

**Fix**:
```bash
git rm --cached backend/.env frontend/.env .env
echo "backend/.env" >> .gitignore
echo "frontend/.env" >> .gitignore
echo ".env" >> .gitignore
git commit -m "fix: remove tracked .env files from Git"
```
Then rotate the LemonSqueezy API key.

---

### C2: `new Function()` used for user-provided code execution
**Layer**: SAST
**Risk**: Remote Code Execution. Arbitrary code from users/plugins is executed via `new Function()` with no sandbox.

**Evidence** (8 occurrences):
- `services/playwright-runner-utils.ts:46` — `new Function('page', code)`
- `services/test-intelligence/AutoFixEngine.ts:415` — `new Function(fixedCode)`
- `services/marketplace/PluginInstaller.ts:137` — `new Function(...)`
- `services/marketplace/PluginSandbox.ts:43,106` — `new Function(code)`
- `services/DataTransformationService.ts:804,815` — `new Function('data', code)`

**Fix**: Replace `new Function()` with a proper sandbox:
- Use `vm2` or `isolated-vm` for Node.js
- Use Cloudflare Workers `eval()` isolation (already sandboxed per-request)
- At minimum: input validation + AST parsing to block dangerous patterns

---

### C3: Fallback JWT secrets in production code
**Layer**: SAST
**Risk**: If `JWT_SECRET` env var is missing, auth falls back to predictable strings like `'fallback-secret'` — anyone can forge tokens.

**Evidence**:
- `middleware/authMiddleware.ts:20` — `process.env.JWT_SECRET || 'fallback-secret'`
- `config/config.ts:26` — `process.env.JWT_SECRET || 'default-secret'`
- `lib/finsavvyai-init.ts:41` — `process.env.JWT_SECRET || 'fallback-secret'`

**Fix**: Throw on missing secret in production:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production');
}
```

---

## HIGH Findings

### H1: Nodemailer vulnerabilities (7 CVEs, 2 high severity)
**Layer**: Dependency Audit
**Risk**: SMTP command injection, DoS via recursive parsing, email routing to unintended domains.

**Fix**: `npm install nodemailer@8.0.5` (or replace with Resend)

---

### H2: MD5 used for cache keys
**Layer**: SAST
**Risk**: MD5 is cryptographically broken. While used for cache keys (not password hashing), it enables cache poisoning via collision attacks.

**Evidence**:
- `services/cache/CacheMiddleware.ts:82`
- `services/AIService.ts:157`
- `services/SmartSelectorService.ts:311,326`

**Fix**: Replace `createHash('md5')` with `createHash('sha256')`.

---

### H3: No CSRF protection on state-changing API endpoints
**Layer**: SAST
**Risk**: Cross-site request forgery on POST/PUT/DELETE endpoints. JWT in localStorage provides some protection (not auto-sent like cookies), but any XSS could steal the token.

**Fix**: Add CSRF tokens for cookie-based sessions, or ensure all auth is purely Bearer token (no cookie auth).

---

### H4: SQL string interpolation in auth service
**Layer**: SAST
**Risk**: The auth service builds UPDATE queries with string interpolation: `` `UPDATE users SET ${updates.join(', ')}` ``

**Evidence**: `auth/auth.service.ts:911`

**Fix**: Use Drizzle ORM's type-safe update instead of raw SQL string building.

---

## MEDIUM Findings

### M1: spawn() with hardcoded commands (not user input)
Commands like `spawn('appium', ...)` and `spawn('maestro', ...)` are hardcoded — NOT from user input. Low risk but should validate arguments.

### M2: No Content-Security-Policy on frontend
Helmet is configured on Express backend but the Vite frontend serves no CSP headers. Add via `index.html` meta tag or Cloudflare Pages headers.

### M3: CORS allows localhost origins in all environments
The CORS config includes `localhost:3000` and `localhost:5173` even in production. Should be environment-conditional.

### M4: No rate limiting on OAuth callback endpoints
OAuth initiation is rate-limited but callback endpoints (`/api/auth/*/callback`) are not — could be abused for token exchange flooding.

### M5: SSO state cookie missing `secure` flag in dev
`sso.routes.ts:136` sets `httpOnly: true, sameSite: 'strict'` but `secure` is conditional — ensure it's `true` in production.

### M6: `page.$$eval` in test scripts
Used for DOM evaluation in Playwright scripts. Low risk (test-only code), but should not be in production bundle.

---

## LOW Findings

### L1: 15 outdated dependencies (no known CVEs)
Several packages have newer versions. Run `npm outdated` for details.

### L2: No Subresource Integrity on CDN resources
If using external CDN resources, add SRI hashes.

---

## What's Good (Passing Checks)

| Check | Status |
|-------|--------|
| Password hashing (bcrypt, 12 rounds) | PASS |
| JWT tokens with expiration | PASS |
| PKCE on all OAuth flows | PASS |
| Helmet security headers | PASS |
| Rate limiting on auth endpoints | PASS |
| No `eval()` in application code | PASS (only `new Function`) |
| No XSS (`dangerouslySetInnerHTML`) | PASS |
| No path traversal | PASS |
| No JWT `none` algorithm | PASS |
| OAuth state parameter CSRF protection | PASS |
| RBAC permission system | PASS |
| Cookie security flags (SSO) | PASS |

---

## Fix Priority

| Priority | Finding | Effort | Risk Reduction |
|----------|---------|--------|---------------|
| **Now** | C1: Remove .env from Git + rotate keys | 10 min | Critical |
| **Now** | C3: Throw on missing JWT_SECRET in prod | 5 min | Critical |
| **Today** | H1: Update nodemailer to 8.0.5 | 5 min | High |
| **Today** | H2: Replace MD5 with SHA-256 for cache keys | 15 min | High |
| **This week** | C2: Sandbox `new Function()` calls | 2 hours | Critical |
| **This week** | H4: Replace raw SQL with Drizzle ORM | 30 min | High |
| **This week** | M3: Environment-conditional CORS | 15 min | Medium |
| **Next sprint** | M2: Add CSP to frontend | 30 min | Medium |
| **Next sprint** | M4: Rate limit OAuth callbacks | 15 min | Medium |
