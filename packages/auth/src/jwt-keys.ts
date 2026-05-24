import { importJWK, importPKCS8, importSPKI } from "jose";
import type { JWK, KeyLike } from "jose";
import type { Algorithm } from "./types.js";

const encoder = new TextEncoder();

export type SigningKey =
  | { readonly alg: "HS256"; readonly key: Uint8Array }
  | { readonly alg: "RS256"; readonly key: KeyLike };

export type VerificationKey = SigningKey;

export const importHs256Secret = (secret: string): SigningKey => ({
  alg: "HS256",
  key: encoder.encode(secret),
});

export const importRs256PrivatePem = async (pem: string): Promise<SigningKey> => ({
  alg: "RS256",
  key: await importPKCS8(pem, "RS256"),
});

export const importRs256PublicPem = async (
  pem: string,
): Promise<VerificationKey> => ({
  alg: "RS256",
  key: await importSPKI(pem, "RS256"),
});

export const importRs256PublicJwk = async (
  jwk: JWK,
): Promise<VerificationKey> => {
  const key = await importJWK({ ...jwk, alg: "RS256" }, "RS256");
  if (typeof key === "object" && key !== null && "type" in key) {
    return { alg: "RS256", key: key as KeyLike };
  }
  throw new Error("Invalid RS256 JWK");
};

export const algorithmsForVerify = (preferred?: Algorithm): Algorithm[] =>
  preferred === "HS256" ? ["HS256", "RS256"] : ["RS256", "HS256"];
