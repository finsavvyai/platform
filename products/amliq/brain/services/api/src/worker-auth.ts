import type { AuthClaims, AuthVerifier } from "./types.js";

export interface BrainWorkerAuthEnv {
  readonly BRAIN_AUTH_TOKEN?: string;
  readonly BRAIN_REQUIRED_ROLE?: string;
  readonly BRAIN_JWT_HS256_SECRET?: string;
  readonly BRAIN_JWT_ISSUER?: string;
  readonly BRAIN_JWT_AUDIENCE?: string;
}

interface JwtHeader {
  readonly alg?: unknown;
  readonly typ?: unknown;
}

type JwtPayload = Readonly<Record<string, unknown>>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const workerRequiredRole = (env: BrainWorkerAuthEnv): string =>
  env.BRAIN_REQUIRED_ROLE ?? "aml:decision:write";

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const isJwtConfigured = (env: BrainWorkerAuthEnv): boolean =>
  Boolean(
    env.BRAIN_JWT_HS256_SECRET
      && env.BRAIN_JWT_ISSUER
      && env.BRAIN_JWT_AUDIENCE,
  );

const base64UrlDecode = (raw: string): Uint8Array | null => {
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  try {
    const binary = globalThis.atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
};

const decodeJsonPart = <T>(raw: string): T | null => {
  const bytes = base64UrlDecode(raw);
  if (bytes === null) return null;
  try {
    return JSON.parse(textDecoder.decode(bytes)) as T;
  } catch {
    return null;
  }
};

const getString = (payload: JwtPayload, key: string): string | null => {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
};

const getNumber = (payload: JwtPayload, key: string): number | null => {
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const getRoles = (payload: JwtPayload): readonly string[] | undefined => {
  const v = payload.roles;
  if (!Array.isArray(v)) return undefined;
  const roles = v.filter((role): role is string => typeof role === "string");
  return roles.length > 0 ? roles : undefined;
};

const audienceMatches = (
  aud: unknown,
  expected: string,
): aud is string | readonly string[] => {
  if (typeof aud === "string") return aud === expected;
  if (!Array.isArray(aud)) return false;
  return aud.some((item) => item === expected);
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
};

const verifyHs256Signature = async (
  signingInput: string,
  signature: Uint8Array,
  secret: string,
): Promise<boolean> => {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      textEncoder.encode(signingInput),
    ),
  );
  return constantTimeEqual(signature, expected);
};

const createJwtVerifier = (env: BrainWorkerAuthEnv): AuthVerifier => ({
  verify: async (token) => {
    const secret = env.BRAIN_JWT_HS256_SECRET;
    const issuer = env.BRAIN_JWT_ISSUER;
    const audience = env.BRAIN_JWT_AUDIENCE;
    if (!secret || !issuer || !audience) {
      return { ok: false, error: "invalid_token" };
    }

    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, error: "invalid_token" };
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return { ok: false, error: "invalid_token" };
    }

    const header = decodeJsonPart<JwtHeader>(encodedHeader);
    const payload = decodeJsonPart<JwtPayload>(encodedPayload);
    const signature = base64UrlDecode(encodedSignature);
    if (header === null || payload === null || signature === null) {
      return { ok: false, error: "invalid_token" };
    }
    if (header.alg !== "HS256") return { ok: false, error: "invalid_token" };
    if (!(await verifyHs256Signature(
      `${encodedHeader}.${encodedPayload}`,
      signature,
      secret,
    ))) {
      return { ok: false, error: "invalid_token" };
    }

    const sub = getString(payload, "sub");
    const iss = getString(payload, "iss");
    const exp = getNumber(payload, "exp");
    const aud = payload.aud;
    if (!sub || !iss || exp === null || !audienceMatches(aud, audience)) {
      return { ok: false, error: "invalid_token" };
    }
    if (iss !== issuer) return { ok: false, error: "invalid_token" };
    if (exp <= nowSeconds()) return { ok: false, error: "expired_token" };

    const nbf = getNumber(payload, "nbf");
    if (nbf !== null && nbf > nowSeconds()) {
      return { ok: false, error: "invalid_token" };
    }

    const iat = getNumber(payload, "iat");
    const jti = getString(payload, "jti");
    const roles = getRoles(payload);
    const claims: AuthClaims = {
      ...payload,
      sub,
      iss,
      aud,
      exp,
      ...(iat !== null ? { iat } : {}),
      ...(jti !== null ? { jti } : {}),
      ...(roles !== undefined ? { roles } : {}),
    };
    return { ok: true, claims };
  },
});

const createSharedTokenVerifier = (env: BrainWorkerAuthEnv): AuthVerifier => ({
  verify: async (token) => {
    if (!env.BRAIN_AUTH_TOKEN || token !== env.BRAIN_AUTH_TOKEN) {
      return { ok: false, error: "invalid_token" };
    }
    return {
      ok: true,
      claims: {
        sub: "brain-worker-client",
        iss: "amliq-brain-worker",
        aud: "amliq-brain",
        exp: Math.floor(Date.now() / 1000) + 3600,
        roles: [workerRequiredRole(env)],
      },
    };
  },
});

export const createWorkerAuthVerifier = (
  env: BrainWorkerAuthEnv,
): AuthVerifier =>
  isJwtConfigured(env)
    ? createJwtVerifier(env)
    : createSharedTokenVerifier(env);
