# TokenForge — Gap Closure Plan

> Last updated: 2026-05-03
> Status: Case A (substance exists, 6 gaps to close)
> Timeline: 30 days to security-reviewer-ready

## Current State

~7,500 lines of production code. 22 test files. Real ECDSA P-256 with
`extractable: false`. Per-request signing. 7-step server verification
pipeline. WebAuthn FIDO2. 6 native SDKs. 6 server adapters. 4 storage
backends. Trust score engine with 8 AitM heuristics.

## Gap 1: Request Body Not in Signature

**Problem**: Signature covers `sessionId:nonce:timestamp` but not HTTP
method, URL, or body. An AitM modifying request bodies in transit is
not detected by the signature (TLS prevents this in practice, but
security buyers expect transaction signing).

**Fix**: Change signed payload to `method:path:sha256(body):sessionId:nonce:timestamp`.

**Files to change**:
- `packages/tokenforge/src/client/signer.ts` — update `buildSignatureInput()`
- `packages/tokenforge/src/server/verify.ts` — update verification to reconstruct and check expanded payload
- `packages/tokenforge/src/client/interceptor.ts` — pass method + URL + body hash to signer
- All 6 native SDKs — update signing payload format
- Add `X-TF-Body-Hash` header (SHA-256 of request body, empty string hash for GET)

**Breaking change**: Yes. Requires SDK version bump (2.0.0). Server must support both v1 (legacy) and v2 (body-inclusive) signatures during migration via `X-TF-Version` header.

**Effort**: 3 days

## Gap 2: DBSC Primitives Not Wired into Main Pipeline

**Problem**: `dbsc-challenge.ts` and `bound-cookie.ts` exist as standalone
building blocks but are not integrated into `verifyRequest()`. Cannot
claim "DBSC-compatible" without wiring them in.

**Fix**: Add optional DBSC mode to `verifyRequest()` config:
```typescript
{
  dbsc: {
    enabled: true,
    cookieName: '__Secure-tf-bound',
    challengeEndpoint: '/tf/dbsc/challenge',
    rotationInterval: 300, // seconds
  }
}
```

When enabled, `verifyRequest` additionally checks the bound cookie hash
against storage and triggers cookie rotation when TTL is low.

**Files to change**:
- `packages/tokenforge/src/server/verify.ts` — add DBSC step after signature verification
- `packages/tokenforge/src/server/binding.ts` — issue bound cookie during device binding
- `packages/tokenforge/src/server/middleware.ts` — expose DBSC challenge endpoint

**Breaking change**: No. Opt-in via config flag.

**Effort**: 2 days

## Gap 3: Swift SDK Not Using Secure Enclave

**Problem**: Uses `P256.Signing.PrivateKey()` (software) instead of
`SecureEnclave.P256.Signing.PrivateKey` (hardware). Keys are in iOS
Keychain but not hardware-bound.

**Fix**: Change key generation to prefer Secure Enclave with software fallback:
```swift
let privateKey: P256.Signing.PrivateKey
if SecureEnclave.isAvailable {
    privateKey = try SecureEnclave.P256.Signing.PrivateKey()
} else {
    privateKey = P256.Signing.PrivateKey()
}
```

**Files to change**:
- `packages/tokenforge-sdks/swift/TokenForge.swift` — update `generateKeyPair()`

**Breaking change**: No. Transparent upgrade. Existing keys continue to work.

**Effort**: 0.5 days

## Gap 4: React Native SDK Software-Bound

**Problem**: Private key stored as hex string in `react-native-keychain`.
Code honestly documents the limitation but does not offer a hardware path.

**Fix**: Add optional `react-native-secure-key-store` or direct
Keystore/Keychain access via JSI bridge. Detect hardware availability
at runtime:
```typescript
const storage = await detectSecureStorage();
// 'hardware' | 'software'
```

If hardware is available, generate key via native module that calls
Android KeyStore or iOS Secure Enclave directly.

**Files to change**:
- `packages/tokenforge-sdks/react-native/index.ts` — add hardware detection + native module bridge
- New native module: `android/TokenForgeKeyStore.kt` + `ios/TokenForgeSecureEnclave.swift`

**Breaking change**: No. Opt-in. Software fallback remains default.

**Effort**: 5 days (native module work)

## Gap 5: Time-of-Day Trust Signal Is Static

**Problem**: Always returns 5 points. Code comments say "future: ML-based."

**Fix**: Replace with a simple statistical model — track the hour-of-day
distribution of the user's last 30 days of requests. If the current
request falls outside the user's normal active hours (>2 standard
deviations from mean), reduce to 0-2 points. No ML needed — just a
histogram.

**Files to change**:
- `packages/tokenforge/src/server/trust-score.ts` — replace static 5 with histogram lookup
- Storage: add `activity-hours:{userId}` key with 24-bucket histogram

**Breaking change**: No. Score may change slightly for late-night users.

**Effort**: 1 day

## Gap 6: No Full-Chain Integration Test

**Problem**: Individual components tested with real crypto, but no single
test exercises generate → bind → sign → verify.

**Fix**: Add `packages/tokenforge/src/__tests__/full-chain.test.ts`:
```typescript
it('full chain: generate key → bind device → sign request → verify signature', async () => {
  // 1. Client generates ECDSA P-256 keypair
  // 2. Client exports public key as JWK
  // 3. Server binds device (stores public key)
  // 4. Client signs a request with private key
  // 5. Server verifies signature against stored public key
  // 6. Server computes trust score
  // 7. Assert: verified === true, score >= 80
});

it('full chain: revoked session fails verification', async () => {
  // 1-4 same as above
  // 5. Server revokes session
  // 6. Client signs another request
  // 7. Server rejects: session revoked
});

it('full chain: replay attack detected', async () => {
  // 1-4 same as above
  // 5. Replay the same signed request
  // 6. Server rejects: nonce already used
});
```

**Effort**: 1 day

## Gap 7: Publish Threat Model Document

**Problem**: No public artifact explaining what TokenForge stops, what it
doesn't, and what assumptions it relies on. This is the #1 credibility
gap for security-mature buyers.

**Fix**: Create `/security/tokenforge-threat-model` page with:

### What TokenForge Stops
- AitM session replay (stolen cookie replayed from attacker's device)
- Session hijacking via network interception (ECDSA signature fails)
- Credential stuffing with stolen tokens (device binding mismatch)
- Automated bot replay (nonce + timestamp + device fingerprint)

### What TokenForge Does NOT Stop
- Malware on the legitimate device (same caveat as passkeys — attacker
  rides along on the compromised device's signing capability)
- Social engineering (user still clicks)
- XSS-triggered signed requests on ECDSA path (signing not gated by
  user gesture; WebAuthn path IS gesture-gated)
- Clickjacking on signing operation (ECDSA path; WebAuthn path requires
  UV)

### Assumptions
- TLS is intact between client and server (signature prevents body
  tampering only after Gap 1 is closed)
- Integrator correctly calls `verifyRequest()` on all protected routes
- Clock skew between client and server is <60 seconds
- Storage backend (D1/Redis/Postgres) is available for session lookups

### Standards Alignment
- WebAuthn/FIDO2: Compliant (real attestation + assertion flows)
- DPoP (RFC 9449): Inspired, body-signing in progress (Gap 1)
- DBSC: Primitives implemented, pipeline integration in progress (Gap 2)
- Token Binding (RFC 8471): Not implemented (deprecated standard)

**Effort**: 1 day

## Priority Order

| # | Gap | Effort | Impact | Ship by |
|---|-----|--------|--------|---------|
| 1 | Request body signing | 3d | Critical — closes transaction signing gap | Week 1 |
| 7 | Threat model document | 1d | Critical — #1 credibility gap | Week 1 |
| 6 | Full-chain integration test | 1d | High — proves the chain works | Week 1 |
| 2 | DBSC pipeline wiring | 2d | High — enables "DBSC-compatible" claim | Week 2 |
| 3 | Swift Secure Enclave | 0.5d | Medium — hardware binding on iOS | Week 2 |
| 5 | Time-of-day trust signal | 1d | Low — score improvement | Week 3 |
| 4 | React Native hardware keys | 5d | Medium — native module work | Week 3-4 |

**Total: ~13.5 engineering days across 4 weeks.**

## Marketing Claims After Gaps Closed

| Claim | Before | After |
|-------|--------|-------|
| "Stops session hijacking" | True with caveats | True — body signed, conditions documented |
| "Device-bound" | Software-bound on web | Hardware-bound on Android, iOS (SE), hardware-available on web (WebAuthn) |
| "ECDSA P-256" | True but incomplete pitch | "ECDSA P-256 with transaction signing" — the signature covers what matters |
| "Phishing-proof" | Overclaim | Removed. Say "AitM-replay-resistant" instead |
| "DBSC-compatible" | Not yet | Yes — primitives wired into verification pipeline |
| "DPoP-inspired" | Accurate | "DPoP-aligned with body signing" — closer to compliant |

## Definition of Done

TokenForge is security-reviewer-ready when:
- [ ] Gap 1 shipped (body in signature)
- [ ] Gap 2 shipped (DBSC wired in)
- [ ] Gap 3 shipped (Swift Secure Enclave)
- [ ] Gap 6 shipped (full-chain test)
- [ ] Gap 7 published (threat model page)
- [ ] One external security researcher has reviewed the threat model
- [ ] Marketing claims updated to match documented capabilities
