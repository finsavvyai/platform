import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  algorithmsForVerify,
  importHs256Secret,
  importRs256PrivatePem,
  importRs256PublicJwk,
  importRs256PublicPem,
} from "./jwt-keys.js";
import { signToken, verifyToken } from "./jwt.js";

const makeRs256Pair = () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { privatePem: privateKey, publicPem: publicKey };
};

const makeRs256Jwk = () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  return { jwk: jwk as Record<string, unknown>, privatePem };
};

describe("jwt-keys", () => {
  it("HS256 import wraps the secret bytes", () => {
    const key = importHs256Secret("hello-world-secret");
    expect(key.alg).toBe("HS256");
    expect(key.key).toBeInstanceOf(Uint8Array);
  });

  it("RS256 round-trip via PEM", async () => {
    const { privatePem, publicPem } = makeRs256Pair();
    const signKey = await importRs256PrivatePem(privatePem);
    const verifyKey = await importRs256PublicPem(publicPem);
    expect(signKey.alg).toBe("RS256");
    expect(verifyKey.alg).toBe("RS256");

    const { token } = await signToken(signKey, {
      issuer: "rs256-issuer",
      audience: "rs256-aud",
      subject: "u1",
      ttlSeconds: 60,
    });
    const res = await verifyToken(verifyKey, token, {
      issuer: "rs256-issuer",
      audience: "rs256-aud",
    });
    expect(res.ok).toBe(true);
  });

  it("RS256 import via JWK", async () => {
    const { jwk, privatePem } = makeRs256Jwk();
    const verifyKey = await importRs256PublicJwk(jwk as never);
    const signKey = await importRs256PrivatePem(privatePem);
    const { token } = await signToken(signKey, {
      issuer: "jwk-iss",
      audience: "jwk-aud",
      subject: "u1",
      ttlSeconds: 60,
    });
    const res = await verifyToken(verifyKey, token, {
      issuer: "jwk-iss",
      audience: "jwk-aud",
    });
    expect(res.ok).toBe(true);
  });

  it("algorithmsForVerify defaults to RS256 first", () => {
    expect(algorithmsForVerify()).toEqual(["RS256", "HS256"]);
    expect(algorithmsForVerify("HS256")).toEqual(["HS256", "RS256"]);
    expect(algorithmsForVerify("RS256")).toEqual(["RS256", "HS256"]);
  });

  it("rejects symmetric JWK passed as RS256 public key", async () => {
    // An `oct` JWK resolves to a Uint8Array (no `type` property) via importJWK.
    // Defense-in-depth: refuse to wrap it as an RS256 KeyLike.
    const octJwk = {
      kty: "oct",
      k: "AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow",
    };
    await expect(importRs256PublicJwk(octJwk as never)).rejects.toThrow(
      "Invalid RS256 JWK",
    );
  });
});
