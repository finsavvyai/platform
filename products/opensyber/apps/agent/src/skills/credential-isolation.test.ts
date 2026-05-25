import { describe, it, expect } from 'vitest';
import {
  sanitizeEnvForSkill,
  isCredentialPath,
  getBlockedEnvKeys,
} from './credential-isolation.js';

describe('sanitizeEnvForSkill', () => {
  it('passes only declared non-blocked keys', () => {
    const result = sanitizeEnvForSkill(
      ['MY_API_KEY', 'MY_TOKEN'],
      { MY_API_KEY: 'abc123', MY_TOKEN: 'tok456' },
    );
    expect(result).toEqual({ MY_API_KEY: 'abc123', MY_TOKEN: 'tok456' });
  });

  it('blocks OPENSYBER_GATEWAY_TOKEN', () => {
    const result = sanitizeEnvForSkill(
      ['OPENSYBER_GATEWAY_TOKEN'],
      { OPENSYBER_GATEWAY_TOKEN: 'secret' },
    );
    expect(result).toEqual({});
  });

  it('blocks AWS credentials', () => {
    const result = sanitizeEnvForSkill(
      ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'SAFE_VAR'],
      {
        AWS_ACCESS_KEY_ID: 'AKIA...',
        AWS_SECRET_ACCESS_KEY: 'wJalr...',
        SAFE_VAR: 'ok',
      },
    );
    expect(result).toEqual({ SAFE_VAR: 'ok' });
  });

  it('blocks GITHUB_TOKEN and GITHUB_PAT', () => {
    const result = sanitizeEnvForSkill(
      ['GITHUB_TOKEN', 'GITHUB_PAT'],
      { GITHUB_TOKEN: 'ghp_xxx', GITHUB_PAT: 'ghp_yyy' },
    );
    expect(result).toEqual({});
  });

  it('blocks CLERK_SECRET_KEY', () => {
    const result = sanitizeEnvForSkill(
      ['CLERK_SECRET_KEY'],
      { CLERK_SECRET_KEY: 'sk_live_xxx' },
    );
    expect(result).toEqual({});
  });

  it('skips keys not present in secrets', () => {
    const result = sanitizeEnvForSkill(
      ['MISSING_KEY'],
      {},
    );
    expect(result).toEqual({});
  });
});

describe('isCredentialPath', () => {
  it('blocks /proc/self/environ', () => {
    expect(isCredentialPath('/proc/self/environ')).toBe(true);
  });

  it('blocks .env files', () => {
    expect(isCredentialPath('/app/.env')).toBe(true);
    expect(isCredentialPath('/app/.env.local')).toBe(true);
    expect(isCredentialPath('/app/.env.production')).toBe(true);
  });

  it('blocks .ssh directory', () => {
    expect(isCredentialPath('/home/user/.ssh/id_rsa')).toBe(true);
  });

  it('blocks .aws directory', () => {
    expect(isCredentialPath('/home/user/.aws/credentials')).toBe(true);
  });

  it('blocks .kube config', () => {
    expect(isCredentialPath('/home/user/.kube/config')).toBe(true);
  });

  it('allows normal skill paths', () => {
    expect(isCredentialPath('/skills/my-skill/data/output.json')).toBe(false);
    expect(isCredentialPath('/tmp/skill-work/result.txt')).toBe(false);
  });
});

describe('getBlockedEnvKeys', () => {
  it('returns non-empty list', () => {
    const keys = getBlockedEnvKeys();
    expect(keys.length).toBeGreaterThan(10);
  });

  it('includes critical keys', () => {
    const keys = getBlockedEnvKeys();
    expect(keys).toContain('OPENSYBER_GATEWAY_TOKEN');
    expect(keys).toContain('AWS_ACCESS_KEY_ID');
    expect(keys).toContain('GITHUB_TOKEN');
    expect(keys).toContain('CLERK_SECRET_KEY');
    expect(keys).toContain('DATABASE_URL');
  });
});
