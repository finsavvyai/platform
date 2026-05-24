import type { JtiRevocationStore } from "../adapters/jti-revocation.js";
import { subjectFromClaims, type UserResolver } from "../adapters/user-resolver.js";
import { verifyToken, type VerifyOptions } from "../jwt.js";
import type { VerificationKey } from "../jwt-keys.js";
import type { AuthError, AuthMethod, Subject } from "../types.js";
import {
  extractBearer,
  type MiddlewareHandler,
  type MinimalContext,
} from "./context.js";

export type AuthMiddlewareConfig = {
  readonly verificationKeys: readonly VerificationKey[];
  readonly issuer: string;
  readonly audience: string;
  readonly resolver?: UserResolver;
  readonly revocations?: JtiRevocationStore;
  readonly subjectKey?: string;
  readonly methodKey?: string;
  readonly cookieName?: string;
};

const errorStatus = (error: AuthError): number =>
  error === "expired_token" || error === "revoked_token" ? 401 : 401;

const readToken = (ctx: MinimalContext, cookieName?: string): string | undefined => {
  const bearer = extractBearer(ctx.req.header("authorization") ?? ctx.req.header("Authorization"));
  if (bearer) return bearer;
  if (!cookieName) return undefined;
  const cookieHeader = ctx.req.header("cookie") ?? ctx.req.header("Cookie");
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === cookieName) return rest.join("=");
  }
  return undefined;
};

export const createAuthMiddleware = (
  config: AuthMiddlewareConfig,
): MiddlewareHandler => {
  if (config.verificationKeys.length === 0) {
    throw new Error("createAuthMiddleware requires at least one verification key.");
  }
  const subjectKey = config.subjectKey ?? "subject";
  const methodKey = config.methodKey ?? "authMethod";
  const resolver = config.resolver;

  return async (ctx, next) => {
    const token = readToken(ctx, config.cookieName);
    if (!token) {
      return ctx.json({ error: "missing_token" satisfies AuthError }, 401);
    }
    const verifyOpts: VerifyOptions = {
      issuer: config.issuer,
      audience: config.audience,
      ...(config.revocations ? { revocations: config.revocations } : {}),
    };
    let lastError: AuthError = "invalid_token";
    for (const key of config.verificationKeys) {
      const res = await verifyToken(key, token, verifyOpts);
      if (res.ok) {
        const subject: Subject = resolver
          ? (await resolver.resolveByToken({ claims: res.claims, raw: token })) ??
            subjectFromClaims(res.claims)
          : subjectFromClaims(res.claims);
        ctx.set(subjectKey, subject);
        ctx.set(methodKey, "jwt" satisfies AuthMethod);
        await next();
        return undefined;
      }
      lastError = res.error;
    }
    return ctx.json({ error: lastError }, errorStatus(lastError));
  };
};
