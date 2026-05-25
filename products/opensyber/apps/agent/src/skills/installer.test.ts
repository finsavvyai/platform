import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

const mkdirMock = vi.fn().mockResolvedValue(undefined);
const readFileMock = vi.fn();
const writeFileMock = vi.fn().mockResolvedValue(undefined);
const rmMock = vi.fn().mockResolvedValue(undefined);
const accessMock = vi.fn();
const readdirMock = vi.fn();
const unlinkMock = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs', () => ({
  promises: {
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    readFile: (...args: unknown[]) => readFileMock(...args),
    writeFile: (...args: unknown[]) => writeFileMock(...args),
    rm: (...args: unknown[]) => rmMock(...args),
    access: (...args: unknown[]) => accessMock(...args),
    readdir: (...args: unknown[]) => readdirMock(...args),
    unlink: (...args: unknown[]) => unlinkMock(...args),
  },
}));

const execSyncMock = vi.fn();
type ExecFileCb = (err: Error | null, out?: { stdout: string; stderr: string }) => void;
const execFileMock = vi.fn((_cmd: string, args: string[], _opts: unknown, cb: ExecFileCb) => {
  if (args.includes('-tzf')) cb(null, { stdout: 'manifest.json\nindex.js\n', stderr: '' });
  else cb(null, { stdout: '', stderr: '' });
});
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
  execFile: (cmd: string, args: string[], opts: unknown, cb: ExecFileCb) => execFileMock(cmd, args, opts, cb),
}));

const { SkillInstaller } = await import('./installer.js');

function createConfig(): AgentConfig {
  return {
    instanceId: 'inst-1',
    apiBaseUrl: 'https://api.test.com',
    gatewayToken: 'tok',
    healthCheckIntervalMs: 60000,
    securityScanIntervalMs: 30000,
    auditBatchIntervalMs: 300000,
    engineGatewayUrl: 'http://127.0.0.1:18789',
    engineConfigDir: '/home/user/.syber-engine',
  };
}

function createApi(): ApiClient {
  return {
    reportSecurityEvents: vi.fn(),
    reportHealth: vi.fn(),
    checkForUpdates: vi.fn(),
    getVerifiedSkills: vi.fn(),
  } as unknown as ApiClient;
}

describe('SkillInstaller', () => {
  let installer: InstanceType<typeof SkillInstaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installer = new SkillInstaller(createConfig(), createApi());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSkillPath', () => {
    it('returns path under engine config dir', () => {
      expect(installer.getSkillPath('github-integration')).toBe(
        '/home/user/.syber-engine/skills/github-integration',
      );
    });
  });

  describe('ensureSkillsDir', () => {
    it('creates skills directory recursively', async () => {
      await installer.ensureSkillsDir();
      expect(mkdirMock).toHaveBeenCalledWith(
        '/home/user/.syber-engine/skills',
        { recursive: true },
      );
    });
  });

  describe('isInstalled', () => {
    it('returns true when manifest.json exists', async () => {
      accessMock.mockResolvedValueOnce(undefined);
      expect(await installer.isInstalled('github-integration')).toBe(true);
    });

    it('returns false when manifest.json missing', async () => {
      accessMock.mockRejectedValueOnce(new Error('ENOENT'));
      expect(await installer.isInstalled('github-integration')).toBe(false);
    });
  });

  describe('readManifest', () => {
    it('reads and parses manifest.json', async () => {
      const manifest = {
        name: 'GitHub Integration',
        slug: 'github-integration',
        version: '1.0.0',
        description: 'Watches repos',
        entrypoint: 'index.js',
        permissions: { network: ['api.github.com'], filesystem: ['./data/'], env: ['GITHUB_TOKEN'] },
        author: 'opensyber',
      };
      readFileMock.mockResolvedValueOnce(JSON.stringify(manifest));
      const result = await installer.readManifest('github-integration');
      expect(result).toEqual(manifest);
    });

    it('returns null when manifest is missing', async () => {
      readFileMock.mockRejectedValueOnce(new Error('ENOENT'));
      expect(await installer.readManifest('nonexistent')).toBeNull();
    });
  });

  describe('uninstall', () => {
    it('removes skill directory recursively', async () => {
      await installer.uninstall('github-integration');
      expect(rmMock).toHaveBeenCalledWith(
        '/home/user/.syber-engine/skills/github-integration',
        { recursive: true, force: true },
      );
    });
  });

  describe('listInstalled', () => {
    it('returns directory names from skills folder', async () => {
      readdirMock.mockResolvedValueOnce([
        { name: 'github-integration', isDirectory: () => true },
        { name: 'slack-notifier', isDirectory: () => true },
        { name: '.DS_Store', isDirectory: () => false },
      ]);
      const result = await installer.listInstalled();
      expect(result).toEqual(['github-integration', 'slack-notifier']);
    });

    it('returns empty array when skills dir does not exist', async () => {
      readdirMock.mockRejectedValueOnce(new Error('ENOENT'));
      expect(await installer.listInstalled()).toEqual([]);
    });
  });

  describe('install', () => {
    it('creates skill directory, writes tarball, and extracts', async () => {
      const manifest = {
        name: 'Test',
        slug: 'test-skill',
        version: '1.0.0',
        description: 'Test skill',
        entrypoint: 'index.js',
        permissions: { network: [], filesystem: [], env: [] },
        author: 'test',
      };
      readFileMock.mockResolvedValueOnce(JSON.stringify(manifest));

      const result = await installer.install('test-skill', Buffer.from('fake').toString('base64'));
      expect(mkdirMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalled();
      expect(execFileMock).toHaveBeenCalledWith(
        'tar',
        expect.arrayContaining(['-tzf']),
        expect.any(Object),
        expect.any(Function),
      );
      expect(execFileMock).toHaveBeenCalledWith(
        'tar',
        expect.arrayContaining(['-xzf', '--no-same-owner', '--no-same-permissions', '--no-overwrite-dir', '--numeric-owner']),
        expect.any(Object),
        expect.any(Function),
      );
      expect(unlinkMock).toHaveBeenCalled();
      expect(result).toEqual(manifest);
    });

    it('throws when manifest is missing from package', async () => {
      readFileMock.mockRejectedValueOnce(new Error('ENOENT'));
      await expect(
        installer.install('bad-skill', Buffer.from('fake').toString('base64')),
      ).rejects.toThrow('Invalid skill package');
    });

    it('rejects slugs containing path traversal characters', async () => {
      await expect(
        installer.install('../etc', Buffer.from('fake').toString('base64')),
      ).rejects.toThrow('Invalid skill slug');
    });

    it('rejects tarballs with path traversal entries', async () => {
      execFileMock.mockImplementationOnce((_cmd: string, args: string[], _opts: unknown, cb: ExecFileCb) => {
        if (args.includes('-tzf')) cb(null, { stdout: 'manifest.json\n../../etc/passwd\n', stderr: '' });
        else cb(null, { stdout: '', stderr: '' });
      });
      await expect(
        installer.install('good-slug', Buffer.from('fake').toString('base64')),
      ).rejects.toThrow('path traversal');
      expect(rmMock).toHaveBeenCalled();
    });

    it('rejects tarballs with absolute-path entries', async () => {
      execFileMock.mockImplementationOnce((_cmd: string, args: string[], _opts: unknown, cb: ExecFileCb) => {
        if (args.includes('-tzf')) cb(null, { stdout: '/etc/cron.d/foo\n', stderr: '' });
        else cb(null, { stdout: '', stderr: '' });
      });
      await expect(
        installer.install('good-slug', Buffer.from('fake').toString('base64')),
      ).rejects.toThrow('absolute path');
    });

    it('rejects a package whose SHA-256 does not match the expected digest', async () => {
      const data = Buffer.from('fake').toString('base64');
      const wrongSha = 'f'.repeat(64);
      await expect(
        installer.install('good-slug', data, wrongSha),
      ).rejects.toThrow('integrity check failed');
    });

    it('accepts a package whose SHA-256 matches the expected digest', async () => {
      const { createHash } = await import('node:crypto');
      const rawBuffer = Buffer.from('legit-package');
      const data = rawBuffer.toString('base64');
      const correctSha = createHash('sha256').update(rawBuffer).digest('hex');

      const manifest = {
        name: 'T', slug: 'good-slug', version: '1.0.0', description: 'x',
        entrypoint: 'index.js',
        permissions: { network: [], filesystem: [], env: [] },
        author: 't',
      };
      readFileMock.mockResolvedValueOnce(JSON.stringify(manifest));

      const result = await installer.install('good-slug', data, correctSha);
      expect(result).toEqual(manifest);
    });

    it('rejects a malformed expected SHA-256 digest', async () => {
      await expect(
        installer.install('good-slug', Buffer.from('x').toString('base64'), 'not-a-hex-digest'),
      ).rejects.toThrow('Invalid expected SHA-256 digest');
    });

    describe('Ed25519 signature enforcement', () => {
      // Helpers to build a signed installer scenario using node:crypto.
      async function setupSignedInstaller() {
        const { generateKeyPairSync, createPrivateKey, sign } = await import('node:crypto');
        const pair = generateKeyPairSync('ed25519');
        const publicJwk = pair.publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
        const privateKey = createPrivateKey({ key: pair.privateKey.export({ format: 'jwk' }), format: 'jwk' });
        const signingConfig = { ...createConfig(), skillSigningPublicKey: JSON.stringify(publicJwk) };
        const signedInstaller = new SkillInstaller(signingConfig, createApi());
        return { signedInstaller, privateKey, sign };
      }

      it('rejects install when public key is pinned but signature is missing', async () => {
        const { signedInstaller } = await setupSignedInstaller();
        await expect(
          signedInstaller.install('good-slug', Buffer.from('x').toString('base64')),
        ).rejects.toThrow('signature required');
      });

      it('rejects install when signature is malformed', async () => {
        const { signedInstaller } = await setupSignedInstaller();
        await expect(
          signedInstaller.install('good-slug', Buffer.from('x').toString('base64'), undefined, 'not-hex'),
        ).rejects.toThrow('Invalid Ed25519 signature format');
      });

      it('rejects install when signature does not verify', async () => {
        const { signedInstaller } = await setupSignedInstaller();
        const bogusSig = 'a'.repeat(128);
        await expect(
          signedInstaller.install('good-slug', Buffer.from('x').toString('base64'), undefined, bogusSig),
        ).rejects.toThrow('signature verification failed');
      });

      it('accepts a correctly signed package', async () => {
        const { signedInstaller, privateKey, sign } = await setupSignedInstaller();
        const rawBuffer = Buffer.from('trusted-package-bytes');
        const signature = sign(null, rawBuffer, privateKey).toString('hex');
        const manifest = {
          name: 'T', slug: 'good-slug', version: '1.0.0', description: 'x',
          entrypoint: 'index.js',
          permissions: { network: [], filesystem: [], env: [] },
          author: 't',
        };
        readFileMock.mockResolvedValueOnce(JSON.stringify(manifest));
        const result = await signedInstaller.install(
          'good-slug',
          rawBuffer.toString('base64'),
          undefined,
          signature,
        );
        expect(result).toEqual(manifest);
      });
    });
  });
});
