import { hashApiKey, timingSafeEqualStr } from "../hmac.js";
import { randomTokenId } from "../token-utils.js";
import type { AuthError } from "../types.js";
import { extractBearer, type MiddlewareHandler } from "./context.js";

export type ScimTokenLookup = (hash: string) => Promise<
  | { readonly orgId: string; readonly scopes: readonly string[] }
  | undefined
>;

export type ScimMiddlewareConfig = {
  readonly lookup: ScimTokenLookup;
  readonly pepper?: string;
  readonly requiredScope?: string;
  readonly orgKey?: string;
};

export const createScimAuthMiddleware = (
  config: ScimMiddlewareConfig,
): MiddlewareHandler => {
  const orgKey = config.orgKey ?? "scimOrgId";
  const pepper = config.pepper ?? "";
  return async (ctx, next) => {
    const token = extractBearer(
      ctx.req.header("authorization") ?? ctx.req.header("Authorization"),
    );
    if (!token) {
      return ctx.json({ error: "missing_token" satisfies AuthError }, 401);
    }
    const hash = await hashApiKey(token, pepper);
    const entry = await config.lookup(hash);
    if (!entry) {
      return ctx.json({ error: "invalid_token" satisfies AuthError }, 401);
    }
    if (config.requiredScope && !entry.scopes.includes(config.requiredScope)) {
      return ctx.json({ error: "unauthorized" satisfies AuthError }, 403);
    }
    ctx.set(orgKey, entry.orgId);
    await next();
    return;
  };
};

export type ScimTokenIssue = {
  readonly plaintext: string;
  readonly hash: string;
  readonly prefix: string;
};

export const generateScimToken = async (
  prefix: string = "scim",
  pepper: string = "",
): Promise<ScimTokenIssue> => {
  const random = randomTokenId(32);
  const plaintext = `${prefix}_${random}`;
  const hash = await hashApiKey(plaintext, pepper);
  return { plaintext, hash, prefix };
};

export const verifyScimTokenHash = async (
  plaintext: string,
  expectedHash: string,
  pepper: string = "",
): Promise<boolean> => {
  const hash = await hashApiKey(plaintext, pepper);
  return timingSafeEqualStr(hash, expectedHash);
};
