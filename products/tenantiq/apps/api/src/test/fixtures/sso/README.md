# SSO IdP Test Fixtures

Per-IdP **id_token claim builders** consumed by `sso-callback.test.ts`.

## Why claim builders, not metadata XML

`sso-callback.ts` does two things with provider tokens:

1. **OIDC**: `decodeJwt(idToken)` — base64-decode payload, read `email`/`name`. No SAML XML or `/.well-known` discovery JSON involved in our code path.
2. **SAML**: delegates entirely to `workos.sso.getProfileAndToken(...)`. WorkOS owns IdP metadata parsing, signature validation, etc. We never touch XML.

So testing against real Okta/Entra/Auth0 metadata XML files would test **WorkOS**, not us. Instead, we test our `decodeJwt` + claim-extraction path with realistic per-IdP claim shapes.

## Files

| File | Purpose |
|------|---------|
| `okta-id-token.ts` | Okta OIDC claims: `email`, `name`, `preferred_username`, `groups[]` |
| `entra-id-token.ts` | Entra ID v2.0: `email`, `oid`, `tid`, `roles[]`, B2B-guest variant w/o `email` |
| `auth0-id-token.ts` | Auth0: namespaced custom claims (`https://app.tenantiq.io/roles`), `sub` w/ connection prefix |

Each file exports:
- A `Claims` interface mirroring the real provider payload
- A `*SampleClaims(overrides)` builder returning the default shape

## How tests use them

```ts
import * as jose from 'jose';
import { oktaSampleClaims } from '../test/fixtures/sso/okta-id-token';

const claims = oktaSampleClaims({ email: 'alice@acme.com' });
const idToken = await new jose.SignJWT({ ...claims })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(JWT_SECRET));

// hit /api/sso/callback/oidc?id_token=...
```

The signature is irrelevant — `decodeJwt` is decode-only. We sign with HS256 only because `jose.SignJWT` requires producing a valid JWT structure (`header.payload.signature`).

## Adding a new IdP

1. Create `apps/api/src/test/fixtures/sso/<idp>-id-token.ts` exporting:
   - A `Claims` interface
   - A `<idp>SampleClaims(overrides)` builder
2. Add a section to `sso-callback.test.ts` under `describe('OIDC: per-IdP claim shapes', ...)`
3. Cover at minimum:
   - Default claim shape → email extracted, redirect 302
   - Edge case (missing email, namespaced claim, alternate `sub` format)
4. Update this README

Sources for accurate claim shapes:
- Provider's official documentation (linked in each fixture file)
- Real id_tokens from a sandbox tenant (decode at jwt.io to inspect)
- Provider SDK type definitions (e.g., `@auth0/auth0-spa-js`, `@okta/jwt-verifier`)
