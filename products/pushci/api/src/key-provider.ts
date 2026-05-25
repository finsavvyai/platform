// KeyProvider abstraction — closes ENTERPRISE_CAPABILITIES.md §2.5 "BYOK".
//
// Existing secrets code uses AES-256-GCM with a machine-bound key stored
// locally. That won't pass a bank's KMS review. This interface lets a
// deployment swap the default provider for AWS KMS, Azure Key Vault, GCP
// KMS, or HashiCorp Vault Transit without touching call sites.
//
// The interface is *narrow on purpose*: wrap/unwrap data keys + stamp a
// tenant-scoped KMS key id. Callers do the AES-GCM themselves with the
// returned data key. Envelope encryption. No KMS ever sees the plaintext.

export interface WrappedKey {
  /** Opaque ciphertext of the data key, KMS-specific. */
  ciphertext: Uint8Array;
  /** Human-readable id so operators can trace which KMS key wrapped this. */
  keyId: string;
  /** KMS provider name (default | aws-kms | azure-kv | gcp-kms | vault-transit). */
  provider: string;
}

export interface KeyProvider {
  readonly id: string;
  /** Returns (plaintext 32-byte data key, wrapped blob to persist). */
  generateDataKey(tenantId: string): Promise<{ plaintext: Uint8Array; wrapped: WrappedKey }>;
  /** Unwrap a previously-wrapped data key. */
  unwrap(wrapped: WrappedKey, tenantId: string): Promise<Uint8Array>;
}

// Default provider uses Web Crypto + a deployment-wide root key from env.
// Not BYOK-compliant by itself — it's what the CF Workers API already does.
// Ships so the interface has a working default; enterprise tenants swap in KMS.
export class DefaultKeyProvider implements KeyProvider {
  readonly id = "default";
  private rootKey: Promise<CryptoKey>;

  constructor(rootKeyBase64: string) {
    if (!rootKeyBase64) throw new Error("key-provider: root key required");
    const raw = base64Decode(rootKeyBase64);
    if (raw.byteLength !== 32) throw new Error("key-provider: root key must be 32 bytes");
    this.rootKey = crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async generateDataKey(tenantId: string): Promise<{ plaintext: Uint8Array; wrapped: WrappedKey }> {
    const plaintext = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(tenantId);
    const key = await this.rootKey;
    const ct = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        plaintext,
      ),
    );
    const wrapped: WrappedKey = {
      ciphertext: concat(iv, ct),
      keyId: "default/root",
      provider: this.id,
    };
    return { plaintext, wrapped };
  }

  async unwrap(wrapped: WrappedKey, tenantId: string): Promise<Uint8Array> {
    if (wrapped.provider !== this.id) {
      throw new Error(`key-provider: cannot unwrap ${wrapped.provider} blob`);
    }
    const iv = wrapped.ciphertext.slice(0, 12);
    const ct = wrapped.ciphertext.slice(12);
    const aad = new TextEncoder().encode(tenantId);
    const key = await this.rootKey;
    const pt = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, ct),
    );
    return pt;
  }
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
