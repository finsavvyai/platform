import type { Env } from '../types.js';
import { signSkillTarball } from '../lib/skill-signing.js';

const SKILL_PREFIX = 'skills/';

export interface SkillPackageInfo {
  slug: string;
  version: string;
  size: number;
  uploadedAt: string;
  sha256: string;
  signature?: string;
}

export interface SkillPackagePayload {
  base64: string;
  sha256: string;
  /** Hex-encoded Ed25519 signature over the raw tarball bytes (absent if signing key not configured) */
  signature?: string;
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export const skillPackageService = {
  /**
   * Upload a skill package tarball to R2. Computes SHA-256 of the bytes and
   * stores it in customMetadata so the integrity digest survives alongside
   * the object. Callers should also persist the digest to the skills table.
   */
  async upload(
    slug: string,
    version: string,
    data: ArrayBuffer,
    storage: Env['STORAGE'],
    signingJwk?: string,
  ): Promise<SkillPackageInfo> {
    const key = `${SKILL_PREFIX}${slug}/${version}.tar.gz`;
    const sha256 = await sha256Hex(data);
    const uploadedAt = new Date().toISOString();
    const metadata: Record<string, string> = { slug, version, uploadedAt, sha256 };
    let signature: string | undefined;
    if (signingJwk) {
      signature = await signSkillTarball(data, signingJwk);
      metadata.signature = signature;
    }
    await storage.put(key, data, { customMetadata: metadata });
    return { slug, version, size: data.byteLength, uploadedAt, sha256, signature };
  },

  /**
   * Download a skill package from R2 and verify the stored digest.
   * Returns `{ bytes, sha256 }` where sha256 is recomputed (not trusted
   * from R2 metadata alone). Returns null if not found.
   * Throws if the recomputed digest does not match what was stored.
   */
  async download(
    slug: string,
    version: string,
    storage: Env['STORAGE'],
  ): Promise<{ bytes: ArrayBuffer; sha256: string; signature?: string } | null> {
    const key = `${SKILL_PREFIX}${slug}/${version}.tar.gz`;
    const obj = await storage.get(key);
    if (!obj) return null;
    const bytes = await obj.arrayBuffer();
    const actualSha = await sha256Hex(bytes);
    const storedSha = obj.customMetadata?.sha256;
    if (storedSha && storedSha !== actualSha) {
      throw new Error(`[skill-packages] integrity check failed for ${slug}@${version}`);
    }
    const signature = obj.customMetadata?.signature;
    return { bytes, sha256: actualSha, signature };
  },

  async exists(
    slug: string,
    version: string,
    storage: Env['STORAGE'],
  ): Promise<boolean> {
    const key = `${SKILL_PREFIX}${slug}/${version}.tar.gz`;
    const obj = await storage.head(key);
    return obj !== null;
  },

  async remove(
    slug: string,
    version: string,
    storage: Env['STORAGE'],
  ): Promise<void> {
    const key = `${SKILL_PREFIX}${slug}/${version}.tar.gz`;
    await storage.delete(key);
  },

  /**
   * Return a base64-encoded package alongside its SHA-256 digest so that the
   * agent can verify end-to-end integrity before extracting the tarball.
   */
  async getBase64(
    slug: string,
    version: string,
    storage: Env['STORAGE'],
  ): Promise<SkillPackagePayload | null> {
    const result = await this.download(slug, version, storage);
    if (!result) return null;
    return {
      base64: arrayBufferToBase64(result.bytes),
      sha256: result.sha256,
      signature: result.signature,
    };
  },
};
