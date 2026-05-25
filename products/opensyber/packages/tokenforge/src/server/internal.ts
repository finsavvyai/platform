/**
 * Internal server exports — used by OpenSyber API only.
 * NOT exported from the npm package.
 */
export { tokenForgeMiddleware as tokenForgeMiddlewareInternal } from './middleware-internal.js';
export { importPublicKey, verifySignature } from './crypto.js';
export { TrustScoreEngine, hashFingerprint } from './trust-score.js';
export { verifyRequest } from './verify.js';
export type { TfRequestContext, TfHeaders, VerifyResult } from './verify.js';
export { MemoryStorage } from './storage/memory.js';
export { CloudStorage } from './storage/cloud.js';
// WebAuthn helpers — internal so the OpenSyber API can wire bind/assertion endpoints.
export {
  verifyWebAuthnAttestation,
  verifyWebAuthnAssertion,
  verifyClientDataJSON,
  derToRawEcdsa,
  b64uToBuf,
  bufToB64u,
} from './webauthn-verify.js';
export type { AttestationVerifyResult } from './webauthn-verify.js';
export { decodeCbor } from './cbor.js';
export type { CborValue } from './cbor.js';
// DBSC primitives (Sprint 37)
export { issueChallenge, consumeChallenge } from './dbsc-challenge.js';
export type {
  ChallengeStore,
  ChallengeRecord,
  IssueChallengeInput,
  IssueChallengeOutput,
} from './dbsc-challenge.js';
export {
  issueBoundCookie,
  hashBoundCookie,
  setBoundCookieHeader,
  BOUND_COOKIE_NAME,
} from './bound-cookie.js';
export type { BoundCookie, IssueBoundCookieOptions } from './bound-cookie.js';
export { verifyCompactJws } from './jws-verify.js';
export type { JwsClaims, VerifyJwsOptions, VerifyJwsResult } from './jws-verify.js';
// Policy DSL (Sprint 38)
export {
  evaluatePolicy,
  evaluatePolicies,
  combineActions,
  parsePolicyRules,
} from './policy.js';
export type { PolicyAction, PolicyContext, Policy, Rule } from './policy.js';
// OIDC verifier (Sprint 40 — workforce mode)
export { verifyOidcIdToken } from './oidc-verify.js';
export type {
  OidcClaims,
  JwksKey,
  VerifyOidcOptions,
  VerifyOidcResult,
} from './oidc-verify.js';
// Action-signing verifier (Sprint 39)
export { verifyAction } from './action-verify.js';
export type { VerifyActionOptions, VerifyActionResult } from './action-verify.js';
export { hashActionPayload, canonicalizeAction } from '../shared/action-hash.js';
// Per-action step-up policy (Sprint 39)
export { parseStepUpActions, evaluateStepUpPolicy } from './step-up-policy.js';
export type { StepUpAction, StepUpVerdict } from './step-up-policy.js';
