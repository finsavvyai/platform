import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWorkerAuthVerifier, workerRequiredRole } from "./worker-auth.js";

const base64Url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signHs256 = (
  payload: Readonly<Record<string, unknown>>,
  secret = "jwt-secret",
  header: Readonly<Record<string, unknown>> = { alg: "HS256", typ: "JWT" },
): string => {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64Url(signature)}`;
};

const env = {
  BRAIN_JWT_HS256_SECRET: "jwt-secret",
  BRAIN_JWT_ISSUER: "https://auth.finsavvy.test",
  BRAIN_JWT_AUDIENCE: "amliq-brain",
  BRAIN_REQUIRED_ROLE: "aml:decision:write",
};

const validPayload = (
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> => ({
  sub: "user-1",
  iss: "https://auth.finsavvy.test",
  aud: "amliq-brain",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  roles: ["aml:decision:write"],
  ...overrides,
});

describe("worker auth verifier", () => {
  it("accepts configured HS256 JWTs", async () => {
    const verifier = createWorkerAuthVerifier(env);
    const result = await verifier.verify(signHs256(validPayload()));
    expect(result).toMatchObject({
      ok: true,
      claims: {
        sub: "user-1",
        iss: "https://auth.finsavvy.test",
        aud: "amliq-brain",
        roles: ["aml:decision:write"],
      },
    });
  });

  it("accepts audience arrays", async () => {
    const verifier = createWorkerAuthVerifier(env);
    const result = await verifier.verify(
      signHs256(validPayload({ aud: ["other-api", "amliq-brain"] })),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JWTs", async () => {
    const verifier = createWorkerAuthVerifier(env);
    await expect(verifier.verify("not-a-jwt")).resolves.toStrictEqual({
      ok: false,
      error: "invalid_token",
    });
    await expect(
      verifier.verify(signHs256(validPayload(), "wrong-secret")),
    ).resolves.toStrictEqual({ ok: false, error: "invalid_token" });
    await expect(
      verifier.verify(signHs256(validPayload(), "jwt-secret", { alg: "none" })),
    ).resolves.toStrictEqual({ ok: false, error: "invalid_token" });
    await expect(
      verifier.verify(signHs256(validPayload({ iss: "wrong" }))),
    ).resolves.toStrictEqual({ ok: false, error: "invalid_token" });
    await expect(
      verifier.verify(signHs256(validPayload({ aud: "wrong-api" }))),
    ).resolves.toStrictEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects expired and not-yet-valid JWTs", async () => {
    const verifier = createWorkerAuthVerifier(env);
    await expect(
      verifier.verify(signHs256(validPayload({ exp: Math.floor(Date.now() / 1000) - 1 }))),
    ).resolves.toStrictEqual({ ok: false, error: "expired_token" });
    await expect(
      verifier.verify(signHs256(validPayload({ nbf: Math.floor(Date.now() / 1000) + 60 }))),
    ).resolves.toStrictEqual({ ok: false, error: "invalid_token" });
  });

  it("falls back to shared-token auth when JWT env is incomplete", async () => {
    const verifier = createWorkerAuthVerifier({
      BRAIN_AUTH_TOKEN: "shared-secret",
      BRAIN_REQUIRED_ROLE: "custom:role",
    });
    await expect(verifier.verify("bad")).resolves.toStrictEqual({
      ok: false,
      error: "invalid_token",
    });

    const result = await verifier.verify("shared-secret");
    expect(result).toMatchObject({
      ok: true,
      claims: { roles: ["custom:role"] },
    });
  });

  it("defaults the protected role", () => {
    expect(workerRequiredRole({})).toBe("aml:decision:write");
  });
});
