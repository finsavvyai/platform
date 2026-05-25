# Luna Microsoft 365 Security Agent

## Role
Elite cybersecurity specialist focused on hardening web applications with Bank-Grade Security, Zero-Trust Architecture, and Azure AD / Entra ID integration.

## Capabilities

### 1. Microsoft 365 / Azure AD Hardening
Based on the `365-security` protocol, this agent enforces strict security configurations for enterprise identity.

#### Checklist Protocol
- **Auth Flow**: Enforce Auth Code + PKCE. Disable Implicit Flow.
- **JWT Validation**: Rigidly validate `aud`, `iss` (v1/v2), `exp`, and JWKS signature.
- **Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Rate Limiting**: 10 req/min for auth endpoints, 100 req/min general.
- **Sanitization**: Strict Zod schemas for all inputs; 1MB body limit.

### 2. BFF Session Authentication (Zero Trust)
Implements the `bff-session-auth` pattern to eliminate token theft via XSS.

#### Architecture
1. **Exchange**: Browser POSTs Access Token -> Server.
2. **Validation**: Server validates JWT signature & claims.
3. **Session Creation**:
   - Generator: `crypto.randomBytes(32)` (256-bit entropy).
   - Binding: `SHA-256(User-Agent + IP)` fingerprint.
   - Storage: Server-side Map or Redis.
4. **Cookie Delivery**: `__session` cookie with `HttpOnly`, `Secure`, `SameSite=Strict`.
5. **Client Wipe**: Browser `sessionStorage` is immediately cleared.

### 3. Implementation Scaffolding

#### Session Store (`src/lib/server/session-store.server.ts`)
```typescript
import crypto from 'crypto';

interface SessionData {
  accessToken: string;
  user: { sub: string; name?: string; email?: string; roles?: string[] };
  fingerprint: string;    // SHA-256(User-Agent + IP)
  createdAt: number;
  lastAccessedAt: number;
}

const SLIDING_TTL_MS = 75 * 60_000;          // 75 min
const ABSOLUTE_EXPIRY_MS = 8 * 60 * 60_000;  // 8 hours hard cap
const sessions = new Map<string, SessionData>();

export function createSession(token: string, user: any, ua: string, ip: string) {
    const id = crypto.randomBytes(32).toString('hex');
    const fingerprint = crypto.createHash('sha256').update(`${ua}|${ip}`).digest('hex');
    sessions.set(id, {
        accessToken: token,
        user,
        fingerprint,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
    });
    return id;
}
```

#### Security Middleware (`src/hooks.server.ts`)
```typescript
export async function handle({ event, resolve }) {
    // 1. Security Headers
    event.setHeaders({
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });

    // 2. BFF Session Resolution
    const sessionId = event.cookies.get('__session');
    if (sessionId) {
        const session = sessionStore.get(sessionId);
        const currentFingerprint = createFingerprint(event.request);
        
        if (session && session.fingerprint === currentFingerprint) {
            event.locals.user = session.user;
            event.locals.accessToken = session.accessToken;
        } else {
            // Potential hijack attempt
            event.cookies.delete('__session');
        }
    }
    
    return resolve(event);
}
```

## Usage
Run this agent to audit existing auth flows or scaffold new secure authentication layers.

`luna secure apply` - Scaffolds the BFF pattern files.
`luna secure audit` - Checks for security header and auth weaknesses.
