// Test-only helpers for AWS Role mode E2E tests. Kept out of the main
// aws-routes file so production code never imports vitest/test state.
// Not exported from any route — imported directly by *.test.ts files.

import { vi } from "vitest";
import { createJwt } from "./auth";
import type { Env } from "./types";
import { awsRoutes } from "./aws-routes";

export const AWS_OK_XML = `<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <AssumeRoleResult><Credentials>
    <AccessKeyId>ASIATEMP</AccessKeyId>
    <SecretAccessKey>tempsecret</SecretAccessKey>
    <SessionToken>tempsession</SessionToken>
    <Expiration>2026-04-21T01:00:00Z</Expiration>
  </Credentials></AssumeRoleResult></AssumeRoleResponse>`;

export const AWS_JWT_SECRET = "test-jwt-secret";
export const AWS_SUB = "github:42";

function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

// 32-byte test master key (all zeros), base64url-encoded. Tests never
// touch real secrets; v1.6.7+ POST /credentials refuses to write without
// this being set, so every aws-routes integration test gets it by default.
export const AWS_TEST_ENC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    RUNNERS: makeKV(),
    APP_URL: "https://app.test",
    JWT_SECRET: AWS_JWT_SECRET,
    AWS_STS_ACCESS_KEY_ID: "AKIAPUSHCIBASE",
    AWS_STS_SECRET_ACCESS_KEY: "basesecret",
    PUSHCI_CRED_ENCRYPTION_KEY: AWS_TEST_ENC_KEY,
    PUSHCI_ALLOW_STATIC_CREDS: "1",
    ...overrides,
  } as Env;
}

export async function awsToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return createJwt(
    { sub: AWS_SUB, login: "tester", provider: "github", iat: now, exp: now + 3600 },
    AWS_JWT_SECRET
  );
}

export async function callAws(
  env: Env,
  path: string,
  init: RequestInit & { bearer?: string } = {}
): Promise<Response> {
  const { bearer, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  if (bearer) finalHeaders.set("authorization", `Bearer ${bearer}`);
  return awsRoutes.fetch(
    new Request(`http://api.test${path}`, { ...rest, headers: finalHeaders }),
    env
  );
}

export async function seedCreds(
  env: Env,
  body: Record<string, unknown>
): Promise<Response> {
  return callAws(env, "/credentials", {
    method: "POST",
    bearer: await awsToken(),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Split fetch mock: routes STS calls to one responder, CodePipeline to
// another. Returns the mock so tests can inspect call order and payload.
export function installAwsRouter(
  stsResponder: () => Response,
  cpResponder: () => Response
): ReturnType<typeof vi.fn> {
  const m = vi.fn(async (input: Request | string, _init?: RequestInit) => {
    const u = typeof input === "string" ? input : input.url;
    if (u.startsWith("https://sts.amazonaws.com/")) return stsResponder();
    if (u.startsWith("https://codepipeline.")) return cpResponder();
    throw new Error(`unexpected fetch: ${u}`);
  });
  globalThis.fetch = m as unknown as typeof fetch;
  return m;
}
