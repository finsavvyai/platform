import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import path from 'node:path';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';
import type { SkillManifest } from '@opensyber/shared';

const SKILLS_DIR = 'skills';
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const ED25519_SIG_HEX_REGEX = /^[0-9a-f]{128}$/;
const TAR_TIMEOUT_MS = 30000;
const execFileAsync = promisify(execFile);

function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function verifyEd25519(buffer: Buffer, signatureHex: string, publicKeyJwk: string): boolean {
  try {
    const pubKey = createPublicKey({ key: JSON.parse(publicKeyJwk), format: 'jwk' });
    const sig = Buffer.from(signatureHex, 'hex');
    return cryptoVerify(null, buffer, pubKey, sig);
  } catch {
    return false;
  }
}

function assertSafeSlug(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`Invalid skill slug: must match ${SLUG_REGEX}`);
  }
}

/** List tar entries and reject any that would escape the extraction directory. */
async function assertSafeTarball(tarPath: string): Promise<void> {
  const { stdout } = await execFileAsync('tar', ['-tzf', tarPath], {
    timeout: TAR_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  const entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
  for (const entry of entries) {
    if (entry.startsWith('/') || entry.startsWith('~')) {
      throw new Error(`Refusing absolute path in skill tarball: ${entry}`);
    }
    const segments = entry.split('/');
    if (segments.includes('..')) {
      throw new Error(`Refusing path traversal in skill tarball: ${entry}`);
    }
  }
}

export class SkillInstaller {
  private skillsPath: string;
  private api: ApiClient;
  private signingPublicKey: string | undefined;

  constructor(config: AgentConfig, api: ApiClient) {
    this.skillsPath = path.join(config.engineConfigDir, SKILLS_DIR);
    this.api = api;
    this.signingPublicKey = config.skillSigningPublicKey;
  }

  async ensureSkillsDir(): Promise<void> {
    await fs.mkdir(this.skillsPath, { recursive: true });
  }

  getSkillPath(slug: string): string {
    return path.join(this.skillsPath, slug);
  }

  async isInstalled(slug: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.getSkillPath(slug), 'manifest.json'));
      return true;
    } catch {
      return false;
    }
  }

  async readManifest(slug: string): Promise<SkillManifest | null> {
    try {
      const manifestPath = path.join(this.getSkillPath(slug), 'manifest.json');
      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content) as SkillManifest;
    } catch {
      return null;
    }
  }

  async install(
    slug: string,
    packageData: string,
    expectedSha256?: string,
    signature?: string,
  ): Promise<SkillManifest> {
    assertSafeSlug(slug);
    await this.ensureSkillsDir();
    const skillDir = this.getSkillPath(slug);

    const buffer = Buffer.from(packageData, 'base64');

    if (expectedSha256) {
      const normalized = expectedSha256.toLowerCase();
      if (!SHA256_HEX_REGEX.test(normalized)) {
        throw new Error('Invalid expected SHA-256 digest');
      }
      const actual = sha256Hex(buffer);
      if (actual !== normalized) {
        throw new Error(`Skill package integrity check failed for ${slug}`);
      }
    }

    // Ed25519 signature check — when the agent has a pinned public key,
    // we REQUIRE a valid signature before extracting the tarball. A
    // missing signature is a hard failure (attacker may have stripped it
    // on an otherwise-valid-looking download). No pinned key means the
    // deployment has opted out of package signing.
    if (this.signingPublicKey) {
      if (!signature) {
        throw new Error(`Skill package signature required but not provided for ${slug}`);
      }
      if (!ED25519_SIG_HEX_REGEX.test(signature.toLowerCase())) {
        throw new Error(`Invalid Ed25519 signature format for ${slug}`);
      }
      if (!verifyEd25519(buffer, signature.toLowerCase(), this.signingPublicKey)) {
        throw new Error(`Skill package signature verification failed for ${slug}`);
      }
    }

    await fs.mkdir(skillDir, { recursive: true });

    const tarPath = path.join(skillDir, 'package.tar.gz');
    await fs.writeFile(tarPath, buffer);

    try {
      await assertSafeTarball(tarPath);
      await execFileAsync(
        'tar',
        [
          '-xzf', tarPath,
          '-C', skillDir,
          '--no-same-owner',
          '--no-same-permissions',
          '--no-overwrite-dir',
          '--numeric-owner',
        ],
        { timeout: TAR_TIMEOUT_MS },
      );
    } catch (err) {
      await fs.rm(skillDir, { recursive: true, force: true });
      throw err instanceof Error ? err : new Error('Skill extraction failed');
    }

    try { await fs.unlink(tarPath); } catch { /* ignore cleanup failure */ }

    const manifest = await this.readManifest(slug);
    if (!manifest) {
      await fs.rm(skillDir, { recursive: true, force: true });
      throw new Error(`Invalid skill package: missing manifest.json in ${slug}`);
    }

    console.log(`[SkillInstaller] Installed ${slug}@${manifest.version}`);
    return manifest;
  }

  async uninstall(slug: string): Promise<void> {
    const skillDir = this.getSkillPath(slug);
    await fs.rm(skillDir, { recursive: true, force: true });
    console.log(`[SkillInstaller] Uninstalled ${slug}`);
  }

  async listInstalled(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.skillsPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
}
