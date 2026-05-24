export * from "./types.js";
export { StaticRbac } from "./rbac.js";
export {
  base64UrlEncode,
  base64UrlDecode,
  base64UrlDecodeString,
  randomTokenId,
  sha256Hex,
} from "./token-utils.js";
export { hmacSign, hmacVerify, timingSafeEqualStr, hashApiKey } from "./hmac.js";
export {
  importHs256Secret,
  importRs256PrivatePem,
  importRs256PublicPem,
  importRs256PublicJwk,
  algorithmsForVerify,
  type SigningKey,
  type VerificationKey,
} from "./jwt-keys.js";
export {
  signToken,
  verifyToken,
  type SignOptions,
  type SignResult,
  type VerifyOptions,
  type VerifyResult,
} from "./jwt.js";
export {
  type JtiRevocationStore,
  NullJtiStore,
  InMemoryJtiStore,
} from "./adapters/jti-revocation.js";
export {
  type UserResolver,
  type ResolveByTokenInput,
  type ResolveByApiKeyInput,
  subjectFromClaims,
  ClaimsOnlyResolver,
} from "./adapters/user-resolver.js";
export {
  type SessionStore,
  InMemorySessionStore,
} from "./adapters/session-store.js";
export {
  type MinimalContext,
  type MiddlewareHandler,
  type MiddlewareNext,
  extractBearer,
} from "./middleware/context.js";
export {
  createAuthMiddleware,
  type AuthMiddlewareConfig,
} from "./middleware/auth.js";
export { requireRole, requireTenant } from "./middleware/require-role.js";
export {
  createScimAuthMiddleware,
  generateScimToken,
  verifyScimTokenHash,
  type ScimTokenLookup,
  type ScimMiddlewareConfig,
  type ScimTokenIssue,
} from "./middleware/scim.js";
export {
  type WebAuthnConfig,
  DEFAULT_CHALLENGE_TTL_SECONDS,
  buildWebAuthnConfig,
  isOriginAllowed,
} from "./webauthn/config.js";
export {
  generateChallenge,
  storeChallenge,
  consumeChallenge,
  startChallenge,
} from "./webauthn/challenge.js";
export {
  SHARED_ROLES,
  OPENSYBER_ROLES,
  TENANTIQ_ROLES,
} from "./roles/catalog.js";
