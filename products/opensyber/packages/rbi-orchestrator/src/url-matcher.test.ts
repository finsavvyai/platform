import { describe, it, expect } from 'vitest';
import type { RbiPolicy } from './policies.js';
import { DEFAULT_RBI_POLICIES } from './policies.js';
import { matchPolicy, parseUrlForMatching } from './url-matcher.js';

const exactPolicy: RbiPolicy = {
  id: 'exact-evil',
  name: 'exact',
  description: 'exact host',
  urlPatterns: ['evil.example.com'],
  action: 'block',
  kasmImageId: '',
  durationSeconds: 0,
  priority: 5,
};

const globPolicy: RbiPolicy = {
  id: 'glob-evil',
  name: 'glob',
  description: 'glob match',
  urlPatterns: ['*.example.com'],
  action: 'isolate',
  kasmImageId: 'img',
  durationSeconds: 600,
  priority: 50,
};

const defaultAllow: RbiPolicy = {
  id: 'allow-default',
  name: 'allow',
  description: 'default',
  urlPatterns: ['*'],
  action: 'allow',
  kasmImageId: '',
  durationSeconds: 0,
  priority: 1000,
};

describe('parseUrlForMatching', () => {
  it('lowercases host and preserves pathname', () => {
    const p = parseUrlForMatching('https://EVIL.example.com/Path/X');
    expect(p.host).toBe('evil.example.com');
    expect(p.pathname).toBe('/Path/X');
    expect(p.prefix).toBeNull();
  });

  it('extracts synthetic prefix', () => {
    const p = parseUrlForMatching('nrd:https://newdomain.test/');
    expect(p.prefix).toBe('nrd');
    expect(p.host).toBe('newdomain.test');
  });

  it('handles bare hostnames', () => {
    expect(parseUrlForMatching('Evil.com').host).toBe('evil.com');
  });
});

describe('matchPolicy precedence', () => {
  const policies = [globPolicy, exactPolicy, defaultAllow];

  it('exact host beats glob even with worse priority', () => {
    const r = matchPolicy('https://evil.example.com/x', policies);
    expect(r.policy.id).toBe('exact-evil');
    expect(r.reason).toBe('exact-host');
  });

  it('exact match is case-insensitive on host', () => {
    const r = matchPolicy('https://EVIL.EXAMPLE.COM/', policies);
    expect(r.policy.id).toBe('exact-evil');
  });

  it('falls back to glob when no exact match', () => {
    const r = matchPolicy('https://other.example.com/', policies);
    expect(r.policy.id).toBe('glob-evil');
    expect(r.reason).toBe('glob');
  });

  it('falls back to default when no host matches', () => {
    const r = matchPolicy('https://random.org/', policies);
    expect(r.policy.id).toBe('allow-default');
    expect(r.reason).toBe('default');
  });

  it('throws when no default supplied and nothing matches', () => {
    expect(() => matchPolicy('https://random.org', [exactPolicy])).toThrow();
  });
});

describe('matchPolicy with default policy set', () => {
  it('isolates *.tor2web.io', () => {
    const r = matchPolicy('https://hidden.tor2web.io/', DEFAULT_RBI_POLICIES);
    expect(r.policy.action).toBe('isolate');
    expect(r.policy.id).toBe('isolate-anonymizers');
  });

  it('blocks .exe download paths', () => {
    const r = matchPolicy('https://cdn.example.org/installer.exe', DEFAULT_RBI_POLICIES);
    expect(r.policy.action).toBe('block');
  });

  it('isolates nrd:* prefix-tagged URLs', () => {
    const r = matchPolicy('nrd:https://just-registered.test/', DEFAULT_RBI_POLICIES);
    expect(r.policy.id).toBe('isolate-newly-registered');
    expect(r.reason).toBe('prefix');
  });

  it('isolates threat:* prefix-tagged URLs', () => {
    const r = matchPolicy('threat:https://known-malware.test/', DEFAULT_RBI_POLICIES);
    expect(r.policy.id).toBe('isolate-known-malware-categories');
  });

  it('allows ordinary traffic via default policy', () => {
    const r = matchPolicy('https://github.com/', DEFAULT_RBI_POLICIES);
    expect(r.policy.action).toBe('allow');
  });

  it('breaks tie by priority when specificity is equal', () => {
    const a: RbiPolicy = { ...globPolicy, id: 'a', priority: 10, urlPatterns: ['*.com'] };
    const b: RbiPolicy = { ...globPolicy, id: 'b', priority: 100, urlPatterns: ['*.com'] };
    const r = matchPolicy('https://x.com/', [b, a, defaultAllow]);
    expect(r.policy.id).toBe('a');
  });
});
