import { describe, it, expect } from "vitest";
import { DefaultKeyProvider } from "./key-provider";

function rootKeyB64(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let bin = "";
  buf.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

describe("DefaultKeyProvider", () => {
  it("rejects empty root key", () => {
    expect(() => new DefaultKeyProvider("")).toThrow(/root key required/);
  });

  it("rejects a wrong-length root key", () => {
    const short = btoa("short");
    expect(() => new DefaultKeyProvider(short)).toThrow(/32 bytes/);
  });

  it("generates a 32-byte data key and wraps it", async () => {
    const kp = new DefaultKeyProvider(rootKeyB64());
    const { plaintext, wrapped } = await kp.generateDataKey("tenant-a");
    expect(plaintext.byteLength).toBe(32);
    expect(wrapped.provider).toBe("default");
    expect(wrapped.keyId).toBe("default/root");
    expect(wrapped.ciphertext.byteLength).toBeGreaterThan(32);
  });

  it("round-trips generate → unwrap for the same tenant", async () => {
    const kp = new DefaultKeyProvider(rootKeyB64());
    const { plaintext, wrapped } = await kp.generateDataKey("tenant-a");
    const unwrapped = await kp.unwrap(wrapped, "tenant-a");
    expect(Array.from(unwrapped)).toEqual(Array.from(plaintext));
  });

  it("refuses unwrap with a different tenant (AAD mismatch)", async () => {
    const kp = new DefaultKeyProvider(rootKeyB64());
    const { wrapped } = await kp.generateDataKey("tenant-a");
    await expect(kp.unwrap(wrapped, "tenant-b")).rejects.toThrow();
  });

  it("refuses to unwrap a blob from another provider", async () => {
    const kp = new DefaultKeyProvider(rootKeyB64());
    const fake = {
      ciphertext: new Uint8Array(44),
      keyId: "aws-kms/arn:...",
      provider: "aws-kms",
    };
    await expect(kp.unwrap(fake, "tenant-a")).rejects.toThrow(/cannot unwrap/);
  });
});
