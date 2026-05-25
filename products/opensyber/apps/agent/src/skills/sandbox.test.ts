import { describe, it, expect } from 'vitest';
import {
  createSandboxConfig,
  isNetworkAllowed,
  isPathAllowed,
} from './sandbox.js';
import type { SkillPermissions } from '@opensyber/shared';

function makePermissions(overrides?: Partial<SkillPermissions>): SkillPermissions {
  return {
    network: ['api.github.com', 'github.com'],
    filesystem: ['./data/', './cache/'],
    // Note: GITHUB_TOKEN is blocked by credential isolation — use safe keys
    env: ['SKILL_API_KEY', 'API_KEY'],
    ...overrides,
  };
}

describe('createSandboxConfig', () => {
  it('creates sandbox with allowed domains from permissions', () => {
    const config = createSandboxConfig(makePermissions(), '/skills/gh', {});
    expect(config.allowedDomains.has('api.github.com')).toBe(true);
    expect(config.allowedDomains.has('github.com')).toBe(true);
    expect(config.allowedDomains.has('evil.com')).toBe(false);
  });

  it('resolves relative filesystem paths to skill directory', () => {
    const config = createSandboxConfig(makePermissions(), '/skills/gh', {});
    expect(config.allowedPaths).toContain('/skills/gh/data/');
    expect(config.allowedPaths).toContain('/skills/gh/cache/');
  });

  it('injects only declared env vars from secrets', () => {
    const secrets = { SKILL_API_KEY: 'ghp_abc', API_KEY: 'key123', EXTRA: 'nope' };
    const config = createSandboxConfig(makePermissions(), '/skills/gh', secrets);
    expect(config.envVars.SKILL_API_KEY).toBe('ghp_abc');
    expect(config.envVars.API_KEY).toBe('key123');
    expect(config.envVars.EXTRA).toBeUndefined();
  });

  it('blocks credential env vars even if declared', () => {
    const perms = makePermissions({ env: ['GITHUB_TOKEN', 'AWS_ACCESS_KEY_ID'] });
    const secrets = { GITHUB_TOKEN: 'ghp_xxx', AWS_ACCESS_KEY_ID: 'AKIA...' };
    const config = createSandboxConfig(perms, '/skills/gh', secrets);
    expect(config.envVars.GITHUB_TOKEN).toBeUndefined();
    expect(config.envVars.AWS_ACCESS_KEY_ID).toBeUndefined();
  });

  it('skips env vars not present in secrets', () => {
    const config = createSandboxConfig(makePermissions(), '/skills/gh', {});
    expect(Object.keys(config.envVars)).toHaveLength(0);
  });

  it('applies default resource limits', () => {
    const config = createSandboxConfig(makePermissions(), '/skills/gh', {});
    expect(config.resourceLimits.maxOldGenerationSizeMb).toBe(64);
    expect(config.resourceLimits.maxYoungGenerationSizeMb).toBe(16);
    expect(config.resourceLimits.stackSizeMb).toBe(4);
  });

  it('handles empty permissions', () => {
    const config = createSandboxConfig(
      { network: [], filesystem: [], env: [] },
      '/skills/empty',
      {},
    );
    expect(config.allowedDomains.size).toBe(0);
    expect(config.allowedPaths).toHaveLength(0);
    expect(Object.keys(config.envVars)).toHaveLength(0);
  });

  it('handles non-relative paths in filesystem permissions', () => {
    const config = createSandboxConfig(
      makePermissions({ filesystem: ['logs'] }),
      '/skills/gh',
      {},
    );
    expect(config.allowedPaths).toContain('/skills/gh/logs');
  });
});

describe('isNetworkAllowed', () => {
  const config = createSandboxConfig(makePermissions(), '/skills/gh', {});

  it('allows requests to declared domains', () => {
    expect(isNetworkAllowed('https://api.github.com/repos', config)).toBe(true);
    expect(isNetworkAllowed('https://github.com/user/repo', config)).toBe(true);
  });

  it('blocks requests to undeclared domains', () => {
    expect(isNetworkAllowed('https://evil.com/steal', config)).toBe(false);
    expect(isNetworkAllowed('https://google.com', config)).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isNetworkAllowed('not-a-url', config)).toBe(false);
    expect(isNetworkAllowed('', config)).toBe(false);
  });
});

describe('isPathAllowed', () => {
  const config = createSandboxConfig(makePermissions(), '/skills/gh', {});

  it('allows access within declared paths', () => {
    expect(isPathAllowed('/skills/gh/data/output.json', config)).toBe(true);
    expect(isPathAllowed('/skills/gh/cache/temp', config)).toBe(true);
  });

  it('blocks access outside declared paths', () => {
    expect(isPathAllowed('/etc/passwd', config)).toBe(false);
    expect(isPathAllowed('/skills/other/data', config)).toBe(false);
    expect(isPathAllowed('/skills/gh/src/index.js', config)).toBe(false);
  });
});
