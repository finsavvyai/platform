import { jwtVerify, SignJWT } from "jose";
import type { JtiRevocationStore } from "./adapters/jti-revocation.js";
import type { SigningKey, VerificationKey } from "./jwt-keys.js";
import { randomTokenId } from "./token-utils.js";
import type { AuthError, TokenClaims } from "./types.js";

export type SignOptions = {
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly ttlSeconds: number;
  readonly claims?: Record<string, unknown>;
  readonly includeJti?: boolean;
};

export type SignResult = {
  readonly token: string;
  readonly jti: string | undefined;
  readonly exp: number;
};

export const signToken = async (
  key: SigningKey,
  options: SignOptions,
): Promise<SignResult> => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + options.ttlSeconds;
  const jti = options.includeJti ? randomTokenId() : undefined;
  let builder = new SignJWT({ ...(options.claims ?? {}) })
    .setProtectedHeader({ alg: key.alg })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setSubject(options.subject);
  if (jti) builder = builder.setJti(jti);
  const token = await builder.sign(key.key);
  return { token, jti, exp };
};

export type VerifyOptions = {
  readonly issuer: string;
  readonly audience: string;
  readonly revocations?: JtiRevocationStore;
};

export type VerifyResult =
  | { readonly ok: true; readonly claims: TokenClaims }
  | { readonly ok: false; readonly error: AuthError };

export type RotateOptions = VerifyOptions & {
  readonly ttlSeconds: number;
  readonly rotateWithinSeconds: number;
  readonly includeJti?: boolean;
  readonly revokeRotatedJti?: boolean;
};

export type RotateResult =
  | { readonly ok: false; readonly error: AuthError }
  | { readonly ok: true; readonly rotated: false; readonly claims: TokenClaims }
  | {
      readonly ok: true;
      readonly rotated: true;
      readonly claims: TokenClaims;
      readonly token: string;
      readonly jti: string | undefined;
      readonly exp: number;
    };

export const verifyToken = async (
  key: VerificationKey,
  token: string,
  options: VerifyOptions,
): Promise<VerifyResult> => {
  // Defense-in-depth: refuse to verify without an explicit issuer + audience.
  // Misconfiguration should fail closed, not silently skip the check.
  if (!options.issuer || !options.audience) {
    return { ok: false, error: "invalid_token" };
  }
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, error: "invalid_token" };
  }
  try {
    const { payload } = await jwtVerify(token, key.key, {
      issuer: options.issuer,
      audience: options.audience,
      // Pin to the exact algorithm of this key — blocks alg=none and
      // alg-confusion attacks where an attacker swaps RS256<->HS256.
      algorithms: [key.alg],
    });
    if (options.revocations && payload.jti) {
      const revoked = await options.revocations.isRevoked(payload.jti);
      if (revoked) return { ok: false, error: "revoked_token" };
    }
    return { ok: true, claims: payload as unknown as TokenClaims };
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "ERR_JWT_EXPIRED") return { ok: false, error: "expired_token" };
    return { ok: false, error: "invalid_token" };
  }
};

const REGISTERED_CLAIMS = new Set([
  "aud",
  "exp",
  "iat",
  "iss",
  "jti",
  "nbf",
  "sub",
]);

const customClaimsFrom = (claims: TokenClaims): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(claims)) {
    if (REGISTERED_CLAIMS.has(key)) continue;
    out[key] = value;
  }
  return out;
};

export const rotateTokenIfNeeded = async (
  signingKey: SigningKey,
  verificationKey: VerificationKey,
  token: string,
  options: RotateOptions,
): Promise<RotateResult> => {
  const verified = await verifyToken(verificationKey, token, options);
  if (!verified.ok) return verified;

  const now = Math.floor(Date.now() / 1000);
  const remaining = verified.claims.exp - now;
  if (remaining > options.rotateWithinSeconds) {
    return { ok: true, rotated: false, claims: verified.claims };
  }

  const next = await signToken(signingKey, {
    issuer: options.issuer,
    audience: options.audience,
    subject: verified.claims.sub,
    ttlSeconds: options.ttlSeconds,
    claims: customClaimsFrom(verified.claims),
    includeJti: options.includeJti ?? true,
  });

  const nextVerified = await verifyToken(verificationKey, next.token, options);
  if (!nextVerified.ok) return nextVerified;

  if (
    options.revokeRotatedJti !== false
      && options.revocations
      && verified.claims.jti
  ) {
    await options.revocations.revoke(
      verified.claims.jti,
      Math.max(1, remaining),
    );
  }

  return {
    ok: true,
    rotated: true,
    claims: nextVerified.claims,
    token: next.token,
    jti: next.jti,
    exp: next.exp,
  };
};
