import { describe, it, expect } from 'vitest';
import { parseConfigHeader } from './config-parser';

describe('parseConfigHeader', () => {
  it('returns empty config on null', () => {
    expect(parseConfigHeader(null)).toEqual({ ok: true, config: {} });
  });

  it('parses a full config', () => {
    const header = JSON.stringify({
      strategy: 'fallback',
      retry: { attempts: 3, onStatus: [429, 502] },
      cache: { mode: 'semantic', ttl: 3600 },
      targets: [{ provider: 'openai', model: 'gpt-4o', weight: 0.7 }],
      guards: [{ guard: 'contains', config: { words: ['bomb'] }, blockOnFail: true }],
    });
    const r = parseConfigHeader(header);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.strategy).toBe('fallback');
      expect(r.config.targets?.[0].provider).toBe('openai');
      expect(r.config.guards?.[0].guard).toBe('contains');
    }
  });

  it('rejects invalid JSON', () => {
    const r = parseConfigHeader('not json');
    expect(r.ok).toBe(false);
  });

  it('rejects non-object root', () => {
    const r = parseConfigHeader('[]');
    expect(r.ok).toBe(false);
  });

  it('rejects unknown strategy', () => {
    const r = parseConfigHeader(JSON.stringify({ strategy: 'weird' }));
    expect(r.ok).toBe(false);
  });

  it('rejects oversize header', () => {
    const r = parseConfigHeader('x'.repeat(9000));
    expect(r.ok).toBe(false);
  });

  it('tolerates missing/optional fields', () => {
    const r = parseConfigHeader(JSON.stringify({ strategy: 'single' }));
    expect(r.ok).toBe(true);
  });

  it('rejects targets as non-array', () => {
    const out = parseConfigHeader(JSON.stringify({ targets: 'oops' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.join(' ')).toMatch(/targets/);
  });

  it('rejects guards as non-array', () => {
    const out = parseConfigHeader(JSON.stringify({ guards: { not: 'array' } }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.join(' ')).toMatch(/guards/);
  });

  it('drops malformed guards entries (missing guard name)', () => {
    const out = parseConfigHeader(JSON.stringify({ guards: [{ config: { x: 1 } }, { guard: 'allow', blockOnFail: true }] }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.config.guards).toHaveLength(1);
      expect(out.config.guards![0].guard).toBe('allow');
    }
  });

  it('retry.onStatus filters non-numbers', () => {
    const out = parseConfigHeader(JSON.stringify({ retry: { attempts: 3, onStatus: [429, 'oops', 502, null] } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.config.retry?.onStatus).toEqual([429, 502]);
  });

  it('cache.mode unknown strings drop to undefined', () => {
    const out = parseConfigHeader(JSON.stringify({ cache: { mode: 'pirate', ttl: 60 } }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.config.cache?.mode).toBeUndefined();
      expect(out.config.cache?.ttl).toBe(60);
    }
  });

  it('retry without onStatus is fine', () => {
    const out = parseConfigHeader(JSON.stringify({ retry: { attempts: 2 } }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.config.retry?.attempts).toBe(2);
      expect(out.config.retry?.onStatus).toBeUndefined();
    }
  });

  it('drops malformed target entries', () => {
    const r = parseConfigHeader(JSON.stringify({ targets: [{ provider: 'ok' }, { model: 'no-provider' }, null] }));
    if (r.ok) expect(r.config.targets?.length).toBe(1);
  });
});
