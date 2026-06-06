import { describe, expect, it } from "vitest";
import {
  algorithmsForVerify,
  importHs256Secret,
  importRs256PrivatePem,
  importRs256PublicJwk,
  importRs256PublicPem,
} from "./jwt-keys.js";

describe("jwt key helpers", () => {
  it("imports HS256 secrets as bytes", () => {
    const key = importHs256Secret("secret");
    expect(key.alg).toBe("HS256");
    expect(Array.from(key.key)).toEqual([115, 101, 99, 114, 101, 116]);
  });

  it("orders verification algorithms by preferred algorithm", () => {
    expect(algorithmsForVerify("HS256")).toEqual(["HS256", "RS256"]);
    expect(algorithmsForVerify("RS256")).toEqual(["RS256", "HS256"]);
    expect(algorithmsForVerify()).toEqual(["RS256", "HS256"]);
  });

  it("rejects invalid RS256 key material", async () => {
    await expect(importRs256PrivatePem("not a pem")).rejects.toThrow();
    await expect(importRs256PublicPem("not a pem")).rejects.toThrow();
    await expect(importRs256PublicJwk({ kty: "oct", k: "bad" })).rejects.toThrow();
  });
});
