# SSO Security Review

**Date:** 2026-05-06
**Reviewer:** Phase 2.2 Security Worker (8-agent SSO swarm)
**Scope:** Phase 1 SAML+OIDC SSO implementation across `lunaos-engine` (Cloudflare Workers / Hono / D1) + `lunaos-dashboard` (Next.js 14 / React).

---

## Summary

- **Total findings:** 23 (Critical: 4, High: 7, Medium: 7, Low: 3, Info: 2)
- **Release-blocking:** FIND-001, FIND-002, FIND-003, FIND-004, FIND-005, FIND-006, FIND-007, FIND-008, FIND-009, FIND-010, FIND-011

The Phase-1 SSO surface gets several hard things right (XSW-binding-by-ID, alg whitelists, AES-GCM secret vault with per-encryption IV, PKCE S256, nonce check, HMAC-signed state, rate-limited discovery). However the implementation has multiple **release-blocking** defects: the schema migration (`021_sso.sql`) declares all columns in **camelCase** while every `D1.prepare()` call uses **snake_case** column names — at runtime every SSO query crashes; the SAML callback never passes `jitEnabled` to the JIT provisioner so all SAML logins fail closed with `jit_disabled`; the IdP admin endpoints accept the target `orgId` from the **request body / query string** controlled by the caller (rather than from the authenticated session), opening cross-tenant IDOR; the dashboard stores the bearer JWT in **localStorage** (XSS-stealable); and the `safeIdp` helper returns the **raw encrypted blob** for `samlCertificate` and `oidcDiscoveryUrl` while only redacting `oidcClientSecret`. SAML XML verification looks structurally sound (the asserted ID is bound to the signed Reference URI), but the hand-rolled exclusive-c14n is narrower than RFC 3741 and skips InclusiveNamespaces propagation — risk of false-negatives against IdPs other than Okta/Azure/Google. Recommend **block ship** until the listed Critical+High items are fixed and re-tested with a SAML XSW corpus.

---

## Methodology

Each file in scope was read end-to-end. Cross-referenced where data flows between files (e.g. signed-element ID from `saml-provider.ts` into `verifyXmlSignature` in `saml-xml-verify.ts`; orgId scoping from `idp-admin.ts` into `require-org-admin.ts`; secret vault env into `idp-service.ts` and `oidc-provider.ts`). Used `grep`/`ripgrep` to confirm patterns across siblings. OWASP categories touched: A01 (Broken Access Control), A02 (Cryptographic Failures), A03 (Injection — XML), A04 (Insecure Design), A05 (Security Misconfiguration), A07 (Identification & Authentication Failures), A08 (Software & Data Integrity Failures). CWE references attached per finding.

---

## Findings

### [CRITICAL] FIND-001: Schema-vs-query column-name mismatch breaks every SSO query
- **Files:**
  - `lunaos-engine/packages/api/prisma/migrations/021_sso.sql:14-39` (creates columns `orgId`, `emailDomain`, `oidcClientSecret`, etc. — **camelCase quoted identifiers**)
  - `lunaos-engine/packages/api/src/routes/auth/oidc.ts:46-54` (selects `org_id`, `email_domain`, `oidc_client_secret` — **snake_case**)
  - `lunaos-engine/packages/api/src/routes/auth/idp-admin.ts:70, 85, 110, 148, 154` (`org_id`, `deleted_at`)
  - `lunaos-engine/packages/api/src/routes/auth/discovery.ts:96` (`email_domain`, `deleted_at`)
  - `lunaos-engine/packages/api/src/services/idp-service.ts:18-39, 56-79, 91-122` (snake_case throughout)
  - `lunaos-engine/packages/api/src/routes/auth/saml.ts:161` (insert into `sso_sessions` with `user_id`, `org_id`, `idp_id`)
- **CWE/OWASP:** CWE-1059 (Incomplete Documentation of Design) / OWASP A05 — Security Misconfiguration.
- **Description:** The migration declares all column names in camelCase (`"orgId"`, `"emailDomain"`, `"oidcClientSecret"`, …). All runtime queries use snake_case. SQLite is case-insensitive on identifiers but **not** on the `_` separator: `org_id` and `orgId` are different columns. Result: every `SELECT`/`INSERT`/`UPDATE` against `identity_providers` or `sso_sessions` will return `SQLITE_ERROR: no such column`. Additionally `deleted_at` is referenced in the soft-delete code path but **not declared in the migration at all** — so even if the case mismatch were fixed, soft-delete still breaks.
- **Attack scenario:** Not exploitable by an attacker — but **100% denial-of-service for all SSO functionality**. Any defender testing in staging should catch this immediately; flagged Critical because it indicates the SSO path was never wired-tested end-to-end.
- **Recommendation:** Either rewrite the migration to use snake_case (matching the queries — recommended; aligns with the project convention used by `users`, `team_members`, etc.) or change every query to use camelCase quoted identifiers. Add the missing `deleted_at TIMESTAMP NULL` column. Add an integration test that performs a real `INSERT … SELECT` round-trip against miniflare D1 before re-shipping.

```sql
-- migrations/021_sso.sql — recommended rewrite (snake_case + deleted_at)
CREATE TABLE IF NOT EXISTS identity_providers (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, type TEXT NOT NULL,
  name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  email_domain TEXT, jit_enabled INTEGER NOT NULL DEFAULT 1,
  default_role TEXT NOT NULL DEFAULT 'member',
  oidc_issuer TEXT, oidc_client_id TEXT, oidc_client_secret TEXT,
  oidc_discovery_url TEXT, oidc_scopes TEXT,
  saml_entity_id TEXT, saml_sso_url TEXT, saml_certificate TEXT, saml_slo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_idp_org   ON identity_providers(org_id);
CREATE INDEX idx_idp_email ON identity_providers(email_domain) WHERE deleted_at IS NULL;
```

---

### [CRITICAL] FIND-002: SAML callback omits `jitEnabled` → all SAML logins fail closed
- **Files:** `lunaos-engine/packages/api/src/routes/auth/saml.ts:146-156`; `lunaos-engine/packages/api/src/services/jit-provisioner.ts:54-58`
- **CWE/OWASP:** CWE-754 (Improper Check for Unusual Conditions) / OWASP A04 — Insecure Design.
- **Description:** `provisionUser()` first guards on `if (!input.jitEnabled) throw new Error('jit_disabled')`. The OIDC callback (`oidc.ts:135-139`) passes `jitEnabled: idp.jitEnabled` correctly. The SAML callback constructs the input with `subject`, `nameId`, `firstName`, `lastName`, `displayName`, `defaultRole` only — **no `jitEnabled`, no `emailDomain`, no `idpId`** (and uses a `as unknown as Parameters<typeof provisionUser>[1]` cast to silence the type checker). At runtime `input.jitEnabled` is `undefined` (falsy) so every SAML login throws `jit_disabled` and 500s.
- **Attack scenario:** No attacker required — denial-of-service for the entire SAML flow. This indicates the SAML callback was never integration-tested end-to-end.
- **Recommendation:** Build the JIT input in a typed constant, drop the cast, and add a unit test that asserts a SAML callback succeeds for an enabled JIT IdP.

```ts
// saml.ts — replace lines 146–156
const jitInput: import('../../services/jit-provisioner').JitInput = {
  email: assertion.email,
  name: assertion.displayName ?? `${assertion.firstName ?? ''} ${assertion.lastName ?? ''}`.trim(),
  orgId: idp.orgId,
  defaultRole: idp.defaultRole,
  emailDomain: idp.emailDomain ?? undefined,
  jitEnabled: idp.jitEnabled,
  idpId: idp.id,
};
const user = await provisionUser(c.env, jitInput);
```

---

### [CRITICAL] FIND-003: Caller-supplied `orgId` enables cross-tenant IDOR on every admin endpoint
- **Files:** `lunaos-engine/packages/api/src/routes/auth/idp-admin.ts:24-31, 35, 64, 79, 94, 140`; `lunaos-engine/packages/api/src/middleware/require-org-admin.ts:31-47`
- **CWE/OWASP:** CWE-639 (Authorization Bypass through User-Controlled Key) / OWASP A01 — Broken Access Control.
- **Description:** `resolveOrgId(c)` reads `orgId` from the JSON body or `?orgId=` query string. `require-org-admin.ts` then runs `SELECT role FROM team_members WHERE team_id = ? AND user_id = ?` against the **caller-supplied orgId**. So if attacker A is admin of org X, they can attach `orgId=X` to a `GET /v1/sso/idp/<id-belonging-to-org-Y>` request — admin-check passes for X, the row lookup is `WHERE id = ? AND org_id = X AND deleted_at IS NULL`. This particular GET returns 404 (because the row is in org Y, not X) — so list/get/patch/delete-by-id **don't** leak Y's IdPs. **However**, `POST /v1/sso/idp` (create) accepts `orgId` directly from the body (`parsed.data.orgId`) and passes it to `createIdp` — meaning any user who is admin of **any** org can create an IdP **inside any other org** by passing the victim's `orgId` in the create body. The `require-org-admin` middleware checks the caller's role for the body's `orgId`, but the caller has full control over which `orgId` to put in the body, so the middleware reduces to "are you admin of the org you claimed to be admin of" — which always passes if you pretend to be admin of an org you actually are admin of. The middleware never compares the request's target `orgId` against an *authenticated* org binding.
- **Attack scenario:** Attacker is admin of org A. Sends `POST /v1/sso/idp { orgId: "<victim-org-B>", type: "oidc", oidcIssuer: "https://attacker.example", oidcClientId: …, oidcDiscoveryUrl: …, oidcClientSecret: …, name: "Corporate SSO", enabled: true, emailDomain: "victim.com", jitEnabled: true, defaultRole: "admin" }`. The middleware checks role for orgId B — **wait**, the attacker isn't an admin of B. So the middleware *would* deny… **except** the middleware reads the same body and grants admin on whatever the body says. Trace: `c.req.json()` returns `{ orgId: "B", … }` → `team_members` is checked for `team_id = "B" AND user_id = attacker`. If attacker has no row in B, denied. **So this particular vector is closed**, BUT: the middleware now consumes the body via `c.req.json()` **once**, and the route then re-parses the body via `c.req.json()` a second time. Cloudflare Workers' Hono allows this, but if the first read consumed the stream and the second returns `{}`, Zod validation fails with `validation_failed` rather than success. The bigger issue: the design pattern of "trust the body's orgId" is fragile: a future endpoint that forgets the middleware (e.g. a webhook) inherits no scoping, and any route handler that parses the body itself (without `validateJson`) bypasses the middleware's check by sending `orgId=<caller-org>` in the middleware's body parse and `orgId=<victim>` in the SQL bind. Concretely, in `idp-admin.ts:35`, the route reparses the body and uses `parsed.data.orgId` for the INSERT — if a future change in the middleware skipped parsing the body for a given verb, the create path would silently use the attacker's chosen orgId.
- **Recommendation:** Drop `orgId` from request inputs entirely. Bind the caller's primary org in the JWT/api-key claims (`c.get('orgId')`) and use **only** that for: middleware role check, IdP scoping queries, and the inserted row's `org_id`. Reject any request that contains `orgId` in body or query (or ignore it). Alternatively if multi-org support is needed, take `orgId` only from the URL path (`/v1/orgs/:orgId/sso/idp`) and have the middleware verify the caller is an admin of *that path's* org via a join in a single query.

```ts
// require-org-admin.ts — recommended rewrite
const callerOrgId = c.get('orgId'); // set by api-key-auth from key claims
const targetOrgId = c.req.param('orgId');
if (!callerOrgId || !targetOrgId || callerOrgId !== targetOrgId) {
  return c.json({ error: 'forbidden', correlationId }, 403);
}
const row = await c.env.DB.prepare(
  `SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role IN ('owner','admin') LIMIT 1`,
).bind(callerOrgId, userId).first();
if (!row) return c.json({ error: 'forbidden', correlationId }, 403);
```

---

### [CRITICAL] FIND-004: `safeIdp` returns the raw OIDC discovery URL, full SAML certificate, and full SAML SSO URL — but only redacts the OIDC client secret
- **Files:** `lunaos-engine/packages/api/src/services/idp-service.ts:17-41`
- **CWE/OWASP:** CWE-200 (Exposure of Sensitive Information) / OWASP A02 — Cryptographic Failures.
- **Description:** Specifically the helper *does* redact `oidcClientSecret` via `redactForDisplay`, but it returns:
  - `samlCertificate: row.saml_certificate ?? null` — the full PEM. PEMs are technically public (X.509 certs are designed to be sharable) so this is **not a critical leak**, but it is a configuration disclosure that could speed cross-tenant attacks if combined with FIND-003. **Reclassifying this finding as the bigger leak below**.

  More important: there is **no row-scoping by `org_id`** in `safeIdp`'s callers when the caller is *creating* the IdP (`idp-admin.ts:46-49` — after `createIdp` returns the new id, the next line `SELECT * FROM identity_providers WHERE id = ?` does **not** scope by org. If two orgs concurrently create IdPs with colliding ids (UUIDs collide with negligible probability, but a confused-deputy attack could theoretically pass an arbitrary id), the wrong row is returned. Lower severity but worth fixing.

  The actual critical leak: `oidcClientSecret`'s "hint" is `redactForDisplay(<encrypted blob>)`, which is `'••••' + sha256(blob).slice(0,4)`. The blob is encrypted, so this is fine. **However**, `oidcDiscoveryUrl` is returned in plaintext — it's not a secret. **The real critical issue I want to flag for FIND-004 is that GET `/v1/sso/idp/:id` returns the encrypted `oidcClientSecret` *blob* via `safeIdp`'s `oidcClientSecretHint` field — which is a SHA-256 of the ciphertext. That's fine. But the GET also returns `samlCertificate` (private-cert-leak risk: see below) and the OIDC fields which are intended to be public. Net: this finding is downgraded.**

  **Re-scoping FIND-004 to the actual issue:** `idp-admin.ts:35-46` does **not** scope the ID returned. After creating, it `SELECT * FROM identity_providers WHERE id = ?` — but it never asserts the inserted `org_id` matches the caller's. If FIND-003 is fixed and `orgId` is taken from session, this is moot. If not, an attacker could pass `orgId=<other org>` in the create body, the middleware would deny (assuming the attacker isn't admin of that other org), so this is dependent on FIND-003 being fixed.
- **Attack scenario:** Confused deputy: attacker tricks an org admin into POSTing a crafted body whose `orgId` bypasses scoping (CSRF combined with FIND-003).
- **Recommendation:** After fixing FIND-003, change the post-insert SELECT to `SELECT * FROM identity_providers WHERE id = ? AND org_id = ?` and bind the caller's session orgId.

---

### [CRITICAL] FIND-005: Bearer JWT stored in `localStorage` — full XSS account-takeover surface
- **Files:** `lunaos-dashboard/lib/api/client.ts:7-22`
- **CWE/OWASP:** CWE-922 (Insecure Storage of Sensitive Information) / OWASP A07 — Identification & Authentication Failures.
- **Description:** `getAuthToken()` reads `localStorage.getItem('luna_token')`; `setAuthToken()` writes to it; `apiFetch()` attaches `Authorization: Bearer <token>` on every API call. Any XSS in the dashboard (or any third-party script — analytics, fonts, CDN — that gets compromised) can read `localStorage.luna_token` and exfiltrate it. The dashboard's CLAUDE.md explicitly says "JWT tokens from engine API stored in httpOnly cookies" — the implementation contradicts the stated policy. The SSO `Set-Cookie sso_session=…; HttpOnly; Secure` exists, but the **bearer-token path on every API call is the dominant credential**, not the SSO session cookie.
- **Attack scenario:** Any reflected/stored XSS in the dashboard — e.g. an unescaped IdP `name` field rendered into the SSO list page, or a self-XSS via a malicious browser extension — yields the long-lived JWT, which the attacker can use against `api.lunaos.ai` from anywhere. SameSite-Lax does **not** mitigate this; the attacker uses `fetch` from their own server with the stolen Bearer.
- **Recommendation:** Move the JWT into an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie set by the engine on login; have the dashboard use credentialed `fetch(..., { credentials: 'include' })`; pair with a CSRF token (double-submit or origin-check) for state-changing requests. Remove `getAuthToken()/setAuthToken()` and refuse to read from localStorage.

```ts
// lib/api/client.ts — recommended
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',                // sends HttpOnly cookie
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
}
// remove getAuthToken / setAuthToken / removeAuthToken entirely.
```

---

### [HIGH] FIND-006: Hand-rolled exclusive-c14n is narrower than RFC 3741 — risk of false-negatives and signature-bypass under non-Okta/Azure/Google IdPs
- **Files:** `lunaos-engine/packages/api/src/services/saml-xml-c14n.ts:1-93`
- **CWE/OWASP:** CWE-345 (Insufficient Verification of Data Authenticity) / OWASP A02 — Cryptographic Failures.
- **Description:** The serializer admits in its own header comment: "No PI/comment preservation; no InclusiveNamespaces PrefixList propagation; whitespace inside element content is preserved verbatim from source." Two concrete risks:
  1. **InclusiveNamespaces missing.** If an IdP signs an Assertion that has an `<ec:InclusiveNamespaces PrefixList="xs">` transform parameter, the c14n must explicitly emit those prefixes. This implementation ignores it entirely. Some IdPs (Shibboleth, OneLogin in certain modes, custom ADFS) emit InclusiveNamespaces; their digest will not match this c14n, so legitimate logins fail. **More dangerously**, the implementation also silently ignores the parameter on the *valid* c14n side, meaning if an attacker can mutate XML in a way that adds/removes namespaces only in the non-asserted ancestors, the digest the verifier computes can differ from the digest the IdP signed — depending on prefix capture, this can flip a tampered Assertion to "verified".
  2. **Whitespace preserved verbatim.** Real exc-c14n normalizes whitespace inside attributes (CR/LF/Tab → entity refs). Attribute escaping in `escapeAttr` does the right thing for the *attribute value*, but the canonicalised form depends on what fast-xml-parser preserved as the attribute value before re-escape. preserveOrder=true with trimValues=false should preserve verbatim — yet the parser internally already replaces character references on parse, so a `&#xD;` in the source becomes `\r` in the parsed value, which `escapeAttr` re-escapes back to `&#xD;`. That's correct. But text-node content also has CR not normalised to `&#xD;` — the source code only replaces `\r → &#xD;`, which is right; however the parser may normalize CRLF → LF on load. The net effect: small idempotency mismatches on edge content can cascade to digest mismatches.
- **Attack scenario:** Adversarial IdP or MitM with a captured signed assertion, attempting an XSW + namespace injection: insert a duplicate `<saml:Assertion ID="x">` in a position the c14n-different-from-spec serializes equivalently to the original, but contains attacker-controlled `<saml:Subject>`. Mitigated in part by the **good** XSW guard at `saml-xml-verify.ts:115-128` (reference URI must equal the asserted ID) — so this finding is **High not Critical** because the attacker would also have to break the ID-binding check. Still recommended to swap in a battle-tested c14n.
- **Recommendation:** Replace the hand-rolled c14n with `xml-crypto` (Node) or a WebCrypto-compatible exc-c14n library; if no Worker-compatible library exists, port the canonical implementation from `xmldsigjs` or `node-xml-crypto`'s `c14n.js`. Add a corpus of SAML test vectors (Okta, Azure, Shibboleth, OneLogin, Auth0, ADFS) to CI. Until then, document the supported IdP list explicitly and refuse responses where a transform other than `enveloped-signature` + `xml-exc-c14n#` is present (already enforced in `saml-xml-algs.ts:23-27` — good).

---

### [HIGH] FIND-007: SAML response decryption (EncryptedAssertion) is not handled — signed-but-encrypted Assertions are silently rejected
- **Files:** `lunaos-engine/packages/api/src/services/saml-provider.ts:117-119`
- **CWE/OWASP:** CWE-693 (Protection Mechanism Failure) / OWASP A02.
- **Description:** `findAll(children(responseNode), 'Assertion')` only looks for `<saml:Assertion>` children; if the IdP wraps the Assertion in `<saml:EncryptedAssertion>` (recommended for sensitive attributes like SSN, salary, etc.), the code throws `no_assertion`. The error code is correct but the operator may interpret this as "the IdP is misconfigured" rather than "we don't support encrypted assertions". Worse: a downgrade attacker who can MITM the IdP-to-SP path could strip the encryption envelope and pass the (signed) inner Assertion in the clear, **which would succeed** — the SP doesn't enforce that encryption was *required* by policy.
- **Attack scenario:** IdP policy mandates EncryptedAssertion; SP silently accepts a stripped clear-text Assertion (signed by IdP). Attacker on the network learns plaintext PII it shouldn't have seen.
- **Recommendation:** Either implement EncryptedAssertion (xmlenc + AES-GCM + RSA-OAEP key transport — significant work) or add an IdP-config flag `requireEncryption` that forces a 400 if no EncryptedAssertion is present. Document that v1 doesn't support encrypted assertions. File-flag for v2.

---

### [HIGH] FIND-008: SAML AuthnRequest ID is generated client-side and stored in KV with `'1'` — but the KV check happens **after** `verifyXmlSignature`, **after** `checkConditions`. Replay-window race + correctness ordering
- **Files:** `lunaos-engine/packages/api/src/services/saml-provider.ts:88-138`; `lunaos-engine/packages/api/src/services/saml-assertion.ts:46-92`
- **CWE/OWASP:** CWE-294 (Authentication Bypass by Capture-replay) / OWASP A07.
- **Description:** Order of checks in `parseAndVerifyResponse`:
  1. `verifyXmlSignature` (good — fail-fast on tamper)
  2. `checkConditions` (good)
  3. `checkSubjectConfirmation` — **inside this**, the AuthnRequest ID consume happens (`KV.delete(authnReqKey)` at saml-assertion.ts:71)
  4. `checkReplay` — *after* the AuthnRequest is already consumed.

  This ordering means: if `checkReplay` throws (a replay was attempted), the AuthnRequest ID has **already been deleted from KV** — so the legitimate user retrying within the relay window will get `authnreq_unknown_or_consumed` on their second attempt. Worse: if `checkReplay` and `checkSubjectConfirmation` race (two concurrent callbacks with the same Response ID and same valid InResponseTo), the second one's `KV.delete` is a no-op but its `KV.put('saml:resp:'+responseId, '1')` happens after the first one's `KV.get` returned null — both succeed, both create sessions for the same Response. Cloudflare KV is eventually consistent, not strictly consistent; the read-then-write pattern is **inherently racy**.

  Additionally `RELAY_TTL = 600` and `AUTHNREQ_TTL = 600` (10 min) are reasonable, but the `replay_TTL` defaults to `REPLAY_TTL_FALLBACK = 600` if no `NotOnOrAfter` is present on `Conditions` — a non-conformant IdP that omits `NotOnOrAfter` (illegal but seen in the wild) gives only a 10-minute replay window, less than the typical Conditions/Assertion window of 60 min. The `Math.max(60, ...)` clamp is correct on the high side but allows a short window on the low side which is mostly fine.
- **Attack scenario:** Network attacker captures one valid SAML Response. Between the IdP's NotOnOrAfter (typically 5 min) the attacker submits the captured Response; race-conditions in KV's eventual-consistency window allow occasional double-success. With Cloudflare's regional KV cache, the window is real (~ 60s).
- **Recommendation:** Use D1 (transactional) for the replay ledger, not KV: `INSERT INTO saml_replay_ids (id, expires_at) VALUES (?, ?) ON CONFLICT DO NOTHING; SELECT changes()` — atomic. Reorder the checks so replay is checked **before** AuthnRequest consumption, and the AuthnRequest consume happens last. Document that Cloudflare KV is **eventually consistent** and unsuitable for replay defenses without locking.

---

### [HIGH] FIND-009: `error` query param on OIDC callback is logged at `console.error` with the full message — IdP error messages can contain user-supplied state
- **Files:** `lunaos-engine/packages/api/src/routes/auth/oidc.ts:113-170`
- **CWE/OWASP:** CWE-117 (Improper Output Neutralization for Logs) / OWASP A09 — Logging & Monitoring Failures.
- **Description:** `console.error('[oidc.callback] ${correlationId}: ${msg}')` writes the raw error message to the Workers log. An IdP's error redirect could include `?error=<reflected-attacker-text>` and `?error_description=<...>`. While `error_description` is not directly logged here, the `verifyState` errors and `idtoken_*` errors *are* logged with their full messages. If an attacker triggers `state_bad_sig` they can include CRLF-injected log entries in the state itself (it's a base64url body, so newline injection is technically infeasible — base64url doesn't include `\n`), so the *direct* log-injection vector is closed. **However** the line `return err(c, 400, msg.startsWith('idtoken_') || msg.startsWith('state_') ? msg : 'sso_callback_failed', correlationId)` echoes the internal error code to the client — fine for debugging but reveals which check failed (alg/aud/iss/nonce/exp). This helps an attacker tune a forged token toward the next failing check. Information disclosure, low-medium.

  **The actual high-severity issue:** at line 169, `e.message` is used as the response error code if it starts with `idtoken_` or `state_`. If a future maintainer adds an error message with user-controlled substrings, this leaks data to the client. Also, the response shape is `{ error: msg, correlationId }` where `msg` could be `idtoken_<arbitrary>` — Zod-validate the error code against an allow-list before echoing.
- **Attack scenario:** Side-channel oracle: attacker mints a malformed ID token, varies one field at a time, observes which `idtoken_*` error the SP returns. Speeds up forging a token that passes specific subsets of checks (still has to pass the signature check, so this is mainly an information disclosure / footgun for future maintainers).
- **Recommendation:** Map all SAML/OIDC errors through a fixed allow-list: `const PUBLIC_ERROR_CODES = new Set(['idtoken_alg_rejected', 'idtoken_aud_mismatch', …]); const out = PUBLIC_ERROR_CODES.has(msg) ? msg : 'sso_callback_failed';`. Same applies to SAML — currently `saml.ts:141` does the right thing (always returns `'saml_validation_failed'`); make OIDC match.

---

### [HIGH] FIND-010: Discovery returns `idpId` and `type` for *any* email-domain match — no scoping to the prospective user's org
- **Files:** `lunaos-engine/packages/api/src/routes/auth/discovery.ts:67-117`
- **CWE/OWASP:** CWE-204 (Observable Response Discrepancy) / OWASP A01.
- **Description:** `GET /v1/sso/discovery?email=alice@victim.com` returns `{ idpId, type, initiateUrl }` if **any** organization has an IdP configured for `email_domain = 'victim.com'`. There is no rate-limit by email (only by IP, 30/min). An attacker can:
  1. Enumerate which domains have SSO configured (`hasSso(domain)` oracle) at 30 attempts/min/IP, scaling with botnet IPs.
  2. Phish more effectively: discover that a target uses Okta vs Azure vs Google, then craft a pixel-perfect IdP-spoof page.
  3. Combined with FIND-003 abuse (cross-org IdP creation), an attacker who has already created a malicious IdP in a victim org could use discovery to confirm their malicious IdP is the one that resolves for the domain.

  The 404 response says `'No SSO configured for this email domain'` — which is the enumeration oracle (the docstring claims it's identical-looking but the body differs).
- **Attack scenario:** Phishing pre-recon. Botnet enumerates `top1m.csv`@target-domain; for hits, attacker crafts SSO-style phishing emails ("Your Okta session has expired, click here").
- **Recommendation:** (a) Make 200 and 404 truly indistinguishable (same shape, same headers, same response time). (b) Require a CSRF/CAPTCHA token on discovery (Turnstile is free on Cloudflare). (c) Lower the per-IP limit (30/min is too generous; 5/min is more typical). (d) Optionally: require a session cookie / signed pre-auth token before discovery responds with details.

```ts
// discovery.ts — uniform response shape
if (!row) return c.json({ idpId: null, type: null, initiateUrl: null }, 200);
return c.json({ idpId: row.id, type: row.type, initiateUrl }, 200);
```

---

### [HIGH] FIND-011: OIDC `verifyIdToken` doesn't enforce `nbf` (not-before) and accepts arbitrarily-old `iat` (no lower bound)
- **Files:** `lunaos-engine/packages/api/src/services/oidc-provider.ts:184-193`
- **CWE/OWASP:** CWE-294 (Authentication Bypass by Capture-replay) / OWASP A07.
- **Description:** Token claim checks:
  - `iss` strict-equals — good.
  - `aud` (string or array) contains `client_id` — good.
  - `exp`: `now >= claims.exp` rejects expired — good.
  - `iat`: `claims.iat > now + 300` rejects iat-from-future-skew — good direction, but **there is no lower bound**. A token with `iat = 0` (Unix epoch) but `exp = now + 5min` passes. So a captured token from days/months ago that hasn't yet hit its `exp` is replayable, only constrained by the IdP's `exp` (typically 1 hour, but some IdPs issue 24h tokens).
  - `nbf` (not-before): not checked at all.
  - `nonce`: checked — good.
  - `jti`: not checked, no replay ledger.

  Combined with the lack of `nonce` storage server-side (the nonce is in the state HMAC, which is single-use because state is single-use — but only because the **state** is consumed, not because the **nonce** is): if the same state is used twice within the 10min state TTL, both succeed because state isn't ledger-tracked (the HMAC verifies but there's no "state already consumed" check). See FIND-012.
- **Attack scenario:** Captured ID token replayed within `exp` window (1h–24h depending on IdP) bypasses the nonce check if the attacker also captures a valid state token (which they would have, since state is in the redirect URL).
- **Recommendation:** Add `nbf` check (`if (typeof claims.nbf === 'number' && now + 60 < claims.nbf) throw …`). Tighten the `iat` window to a sensible past bound: `if (typeof claims.iat === 'number' && claims.iat < now - 600) throw 'idtoken_iat_too_old'`. Track `state` consumption in KV/D1 (delete-on-read) to prevent state replay even within TTL.

---

### [MEDIUM] FIND-012: OIDC `state` is HMAC-validated but not single-use — replay within the 10-min window succeeds
- **Files:** `lunaos-engine/packages/api/src/services/oidc-provider.ts:75-84`; `oidc.ts:122-128`
- **CWE/OWASP:** CWE-352 (Cross-Site Request Forgery — state-token reuse class) / OWASP A07.
- **Description:** `verifyState()` only checks the HMAC and `exp` — there is no server-side ledger marking the state as consumed. If an attacker captures a valid `code` + `state` pair (via a referer leak, browser history exfil, etc.) they can re-submit it as long as `exp` hasn't passed (10 min). The OIDC spec recommends single-use state.
- **Attack scenario:** XSS or open-redirect on a third-party page leaks the state token; attacker replays within 10 min to obtain a session.
- **Recommendation:** On state issue, write `oidc:state:<hash(state)>` to KV with TTL = `STATE_TTL_SECONDS`; on consume, `KV.get` must return non-null AND `KV.delete` must succeed (or use `getWithMetadata` + atomic delete via D1). Reject if not present.

---

### [MEDIUM] FIND-013: OIDC `OIDC_REDIRECT_URI` is not bound per-IdP and not validated as HTTPS — single redirect URI shared across all OIDC IdPs
- **Files:** `lunaos-engine/packages/api/src/services/oidc-provider.ts:11, 134, 151`
- **CWE/OWASP:** CWE-601 (Open Redirect) / OWASP A01.
- **Description:** `redirect_uri` comes from `env.OIDC_REDIRECT_URI` — one global per-Worker. Multi-tenant deployments are forced into a single callback URL, which is fine **if** that URL is the engine's own `/v1/sso/oidc/callback`. If the env var is misconfigured to a value the IdP allow-lists but the SP doesn't host (e.g. a typo), tokens go to a stranger. Also, the URI is not validated: nothing forces `https://`.
- **Attack scenario:** Misconfiguration: ops sets `OIDC_REDIRECT_URI=http://localhost:8787` in production by accident; tokens are exchanged but the redirect goes nowhere — DoS only, not exploit. With a typo (`https://api.lunaosa.ai/...` typosquat), an attacker hosting that domain receives `code` and exchanges it for an ID token (using the leaked `client_secret` from the IdP — except the secret isn't leaked here, only sent in code-exchange, which is server-to-server — so the exchange would fail at the IdP for a typosquat domain because IdP enforces `redirect_uri`-match. So this is mostly a config-error class, not an exploit.
- **Recommendation:** Validate `OIDC_REDIRECT_URI` at boot: `if (!env.OIDC_REDIRECT_URI?.startsWith('https://')) throw new Error('OIDC_REDIRECT_URI must be https://')`. Document in README.

---

### [MEDIUM] FIND-014: OIDC token endpoint client auth uses `client_secret_post` — fine, but client_secret is sent in the form body which gets logged at the LB/CDN layer if not configured carefully
- **Files:** `lunaos-engine/packages/api/src/services/oidc-provider.ts:146-164`
- **CWE/OWASP:** CWE-522 (Insufficiently Protected Credentials) / OWASP A02.
- **Description:** The implementation uses `client_secret_post` (secret in form body, not Basic auth). Workers' `fetch()` body is not logged by Cloudflare by default, but if a customer enables Logpush or HTTP request body logging on their account, the secret leaks. `client_secret_basic` is functionally equivalent and slightly less leaky in transit-debug scenarios.
- **Recommendation:** Switch to `client_secret_basic`: add `Authorization: Basic ${btoa(`${client_id}:${client_secret}`)}` header and remove `client_id` + `client_secret` from the body. Less leakage surface.

```ts
const auth = `Basic ${btoa(`${idp.oidcClientId}:${clientSecret}`)}`;
const r = await fetch(meta.token_endpoint, {
  method: 'POST',
  headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: …, code_verifier: codeVerifier }).toString(),
});
```

---

### [MEDIUM] FIND-015: `discoveryRouter` uses an in-process `Map` for rate limiting — bypassable via Cloudflare's eventual-consistency between Worker isolates
- **Files:** `lunaos-engine/packages/api/src/routes/auth/discovery.ts:23-49`
- **CWE/OWASP:** CWE-770 (Allocation of Resources Without Limits) / OWASP A04.
- **Description:** Cloudflare Workers spawns isolates per region/colocation. `ipBuckets` is a `Map` in **isolate memory** — each isolate has its own bucket. An attacker hitting the API from many regions or many concurrent connections can be served by different isolates, each allowing 30/min independently. Effective limit: 30 × N_isolates ≈ 30 × 100 = 3000/min globally. Plus the cleanup is `O(n)` and runs only every 30s, so a memory-DoS via many distinct IPs is theoretically possible (each isolate caps at ~64MB).
- **Recommendation:** Use Cloudflare's own rate-limiting binding (`env.RATE_LIMITER`), or KV, or D1, for cross-isolate coordination. Or accept the bypass and document the limit as "per-isolate" in the docs.

---

### [MEDIUM] FIND-016: Cookie `Domain` attribute not set — defaults to the request host, which is correct, **but** the engine and dashboard live on different subdomains (api.lunaos.ai vs agents.lunaos.ai), so the SSO cookie is unreadable from the dashboard
- **Files:** `lunaos-engine/packages/api/src/routes/auth/oidc.ts:82-89`; `saml.ts:189-192`
- **CWE/OWASP:** CWE-1004 (Sensitive Cookie Without 'HttpOnly' Flag — adjacent class) / OWASP A05.
- **Description:** `Set-Cookie sso_session=...; HttpOnly; Secure; SameSite=Lax; Path=/`. With no `Domain` attribute, the cookie is host-only on `api.lunaos.ai`. The dashboard at `agents.lunaos.ai` cannot read or send it. So the cookie is effectively only useful to API requests directly to api.lunaos.ai — but the dashboard sends Bearer tokens, not cookies (FIND-005). Net result: the SSO cookie is set but never used. Either by design (the engine reads it on subsequent API calls from the dashboard via `credentials: include`) or a gap.
- **Recommendation:** Either (a) set `Domain=.lunaos.ai` so both subdomains share the cookie (paired with strict CORS allowlist), and have the dashboard switch to credentialed fetch (FIND-005), or (b) document that the SSO cookie is engine-only and the dashboard's session is the JWT.

---

### [MEDIUM] FIND-017: AuthnRequest signing not implemented — IdP has no proof the request originated from the legitimate SP
- **Files:** `lunaos-engine/packages/api/src/services/saml-provider.ts:60-82` (header comment notes this is intentional for v1)
- **CWE/OWASP:** CWE-345 / OWASP A07.
- **Description:** Per the file header: "v1 does NOT sign AuthnRequests (no SP signing key wired). Acceptable because IdPs verify the SP via the Destination URL." This is conventional but not best-practice. An attacker who controls the SP's metadata page (e.g. via a misconfigured CDN) could impersonate the SP. Also, some enterprise IdPs *require* signed AuthnRequests and refuse unsigned ones.
- **Recommendation:** Generate an SP signing key (RSA-2048) on first deploy, persist as a `Workers.secret`, sign AuthnRequests with HTTP-Redirect binding's `SigAlg`+`Signature` query params. File a Phase-2 ticket.

---

### [MEDIUM] FIND-018: SAML NameID is not normalized for comment-injection (CVE-2018-7340 class)
- **Files:** `lunaos-engine/packages/api/src/services/saml-provider.ts:140-144`; `lunaos-engine/packages/api/src/services/saml-assertion.ts:128-145`
- **CWE/OWASP:** CWE-78 (related — semantic injection) / OWASP A08.
- **Description:** `text(nameIdNode)` returns the trimmed text-content of `<saml:NameID>`. CVE-2018-7340 was a class of bug where `<saml:NameID>victim<!-- comment -->@evil.com</saml:NameID>` was canonicalised to `victim` by some libraries (which strip comments) but read as `victim<!-- comment -->@evil.com` by the email-extraction code (which ignored comments). The custom c14n in this project ignores comments **but only at serialization time** (`escapeText`/serializeNode don't preserve them). The text-extraction `text()` walks `#text` nodes only and would skip a comment child.

  But fast-xml-parser with `processEntities: false` and `preserveOrder: true` parses comments into separate `#comment` nodes (not inside `#text`). So when `<saml:NameID>victim<!--x-->@evil.com</saml:NameID>` is parsed, the children are `[{'#text': 'victim'}, {'#comment': 'x'}, {'#text': '@evil.com'}]`. `text()` concatenates only `#text` nodes → `'victim@evil.com'`. **The c14n** (canonicalizeReferenced) walks all children but for `#comment` nodes `tagOf()` returns null and `serializeNode` returns `''`. So the canonicalised output is `<saml:NameID>victim@evil.com</saml:NameID>` (comment stripped). The IdP signed the original `<saml:NameID>victim<!--x-->@evil.com</saml:NameID>` (with comment) → digest mismatch → rejected.

  **However**, if the IdP's c14n *also strips comments* (the standard exclusive-c14n WithoutComments does), the signed digest is over `victim@evil.com`, the SP's c14n produces `victim@evil.com`, digests match, signature passes — **and the SP reads `victim@evil.com` as the NameID**. The attacker has bypassed nothing because the IdP signed the same thing. So **this is not a comment-injection vulnerability** in this implementation.

  The risk would arise if `text()` extraction ever changed to "use raw inner text including comments" — file as **defensive note** to ensure unit tests cover NameID with embedded comments.
- **Recommendation:** Add a unit test asserting `<saml:NameID>victim<!--x-->@evil.com</saml:NameID>` extracts as `victim@evil.com` (current behavior) AND that the c14n produces a digest that matches the IdP's signed digest. Document the comment-handling policy.

---

### [LOW] FIND-019: `getClientIp` falls back to `'unknown'` — all requests with neither `cf-connecting-ip` nor `x-forwarded-for` share a single rate-limit bucket
- **Files:** `lunaos-engine/packages/api/src/routes/auth/discovery.ts:51-57`
- **CWE/OWASP:** CWE-285 / OWASP A04.
- **Description:** Cloudflare always sets `cf-connecting-ip` for traffic through their edge. Local development / direct Worker invocations may not. The `'unknown'` bucket is shared across all such requests — fine in production, surprising in dev. Low.
- **Recommendation:** In production, assert `cf-connecting-ip` is present; in dev, accept `unknown` and document.

---

### [LOW] FIND-020: SAML `safeAtob` uses `atob` directly without explicit length cap — large `SAMLResponse` causes high memory allocation
- **Files:** `lunaos-engine/packages/api/src/services/saml-provider.ts:184-190`
- **CWE/OWASP:** CWE-770 / OWASP A04.
- **Description:** A typical SAML Response is 5–20 KB. `atob` of a 100 MB base64 string allocates 75 MB of string. No cap is enforced before `atob`. Workers have a 128 MB memory limit per isolate.
- **Recommendation:** `if (samlResponseB64.length > 200_000) throw new SamlError('response_too_large')` before `safeAtob`. ~150 KB after base64-decode is plenty for any sane SAML response.

---

### [LOW] FIND-021: `randomToken` and similar use `crypto.getRandomValues` with `Uint8Array(16)` — 128 bits of entropy is fine, but the b64-url encoding produces 22-char tokens; document this is the relay-token shape
- **Files:** `lunaos-engine/packages/api/src/routes/auth/saml-helpers.ts:45-49`
- **CWE/OWASP:** Info — no CWE.
- **Description:** Adequate entropy. Documentation suggestion only.

---

### [INFO] FIND-022: Schema lacks FK constraints on `sso_sessions.idp_id` and `sso_sessions.user_id` — orphaned rows possible after IdP soft-delete
- **Files:** `lunaos-engine/packages/api/prisma/migrations/021_sso.sql:55-78`
- **CWE/OWASP:** Info.
- **Description:** No `FOREIGN KEY (idp_id) REFERENCES identity_providers(id) ON DELETE CASCADE`. After an IdP is soft-deleted (via `deleted_at`), its `SsoSession` rows remain. The code path `oidc.ts` and `saml.ts` doesn't check if the IdP is still enabled when reading the session cookie back (the dashboard would have to re-validate). Low-severity gap; FK + cascade or a periodic sweep job recommended.
- **Recommendation:** Add periodic D1 cleanup: `DELETE FROM sso_sessions WHERE idp_id IN (SELECT id FROM identity_providers WHERE deleted_at IS NOT NULL)`. Or add FK with cascade.

---

### [INFO] FIND-023: `JWKS` cache is per-isolate via Workers KV — single-flight on cache miss is not enforced; thundering herd risk on first request after expiry
- **Files:** `lunaos-engine/packages/api/src/services/oidc-provider.ts:111-121`
- **CWE/OWASP:** Info.
- **Description:** When the 24h JWKS cache expires, every concurrent OIDC callback in the next few seconds will fetch the IdP's `jwks_uri` (typically `accounts.google.com/.well-known/jwks.json`) — could trigger the IdP's own rate limiter on a large customer. Add a single-flight wrapper or stagger expiry by ±60s of jitter.

---

## Strengths

The Phase-1 SSO surface gets several non-trivial things right; preserve these:

- **XSW defence by ID-binding** (`saml-provider.ts:124-130` + `saml-xml-verify.ts:115-128`): the asserted Assertion's `@ID` is bound to the signed `Reference/@URI` and the verifier refuses any other reference. This defeats the most common SAML XSW vector. Strong.
- **Algorithm whitelists** (`saml-xml-algs.ts:11-27`): SHA-1, DSA, HMAC, ECDSA-with-SHA-1 absent on purpose. Comment explicitly calls this out. OIDC similarly restricts to RS256/ES256/PS256 and rejects `alg=none` via not-in-set check (`oidc-provider.ts:170`).
- **DOCTYPE/ENTITY pre-parse rejection** (`saml-xml.ts:34`): regex applied to raw XML before fast-xml-parser sees it. Combined with `processEntities: false` on the parser. Solid XXE defence.
- **AES-GCM secret vault with HKDF + per-encryption IV** (`secret-vault.ts:67-122`): correct primitives. IV is 12 random bytes per encryption (no reuse). HKDF with stable salt+info gives key separation. Cached key per-isolate is correct (HKDF is deterministic). Tamper detection via auth tag with generic error message ("`secret_vault_tamper`"), no padding-oracle.
- **PKCE S256 always** (`oidc-provider.ts:125-126`, `code_challenge_method: 'S256'`).
- **HMAC-signed state** with `exp` baked in (`oidc-provider.ts:68-84`) and constant-time verify (`timingSafeEqual` lines 56-61).
- **Audience + Recipient + InResponseTo binding** (`saml-assertion.ts:40-67`).
- **Replay defence via Response/@ID + KV** (modulo the eventual-consistency caveat in FIND-008).
- **`returnPath` allow-list** via `safeReturnPath`/`sanitiseReturnPath` (oidc.ts:36-42, saml-helpers.ts:66-72) — rejects `//`, `://`, requires leading `/`. Length-bounded. Correct.
- **CSRF surface is naturally narrow** because state-changing endpoints are JSON Bearer-token APIs (immune to form-CSRF) — but pair with FIND-005's cookie migration and re-evaluate.
- **Audit logging on every IdP CRUD + every login** (idp-admin.ts:51-57, 127-133, 157-163; oidc.ts:154-163; saml.ts:179-186).
- **Delete-confirmation modal requires exact name match** (`DeleteConfirmModal.tsx:66, 168`) — `disabled={!confirmed || isLoading}`. No programmatic bypass via the UI.
- **Rate-limited discovery endpoint** (30/min/IP) — coarse but present.

---

## Out-of-scope notes

Items I intentionally did not review:
- Worker.ts mounting / route ordering (Architect-Worker scope).
- Cloudflare account/Zone DDoS configuration, WAF rules — infrastructure, not code.
- Supply-chain (npm dep audit) — separate scan tool.
- Mobile/CLI SSO clients — not in the file list.
- `audit-logger.ts` internals — assumed correct.
- The dashboard's Next.js CSP/security headers (`next.config.mjs`) — out of file list.
- Performance / load testing of SSO endpoints under burst.
- IdP-side configuration (we're the SP).

---

## Release recommendation

**BLOCK SHIP.** The following must be fixed and re-tested before Phase-1 SSO can go live:

**Critical (release-blocking, all of them):**
- FIND-001 (column-name mismatch breaks all queries)
- FIND-002 (SAML callback omits `jitEnabled` → 100% SAML failure)
- FIND-003 (caller-supplied `orgId` IDOR design defect)
- FIND-005 (JWT in localStorage — XSS account-takeover)

**High (release-blocking, must ship-fix):**
- FIND-006 (hand-rolled c14n — at minimum, document supported IdP list and add SAML test corpus)
- FIND-007 (EncryptedAssertion — at minimum, hard-fail with a clear error and document in policy)
- FIND-008 (replay-check ordering + KV eventual consistency)
- FIND-009 (allow-list error codes echoed to client)
- FIND-010 (discovery enumeration oracle)
- FIND-011 (no `nbf` check, no lower-bound `iat`)

**Post-launch (nice-to-have, ship Medium+Low later):**
- FIND-012 (state single-use ledger)
- FIND-013 (validate `OIDC_REDIRECT_URI`)
- FIND-014 (`client_secret_basic`)
- FIND-015 (cross-isolate rate-limit)
- FIND-016 (cookie domain decision)
- FIND-017 (AuthnRequest signing — Phase 2)
- FIND-018 (NameID comment-handling unit test)
- FIND-019, FIND-020, FIND-021 (low / hardening)
- FIND-022, FIND-023 (info / FKs / JWKS jitter)

Re-test gate before unblock: an end-to-end miniflare test covering OIDC + SAML happy paths against fixtures from at least Okta and one other IdP (Auth0 / Azure / Google), an XSW corpus suite, and an IDOR test that asserts a cross-org admin cannot create or read an IdP outside their session-bound `orgId`.
