/** Tests for share helper — channel coverage + deterministic ref hash. */

import { describe, it, expect } from 'vitest';
import { buildShare, refHash } from './share';

const KEY = 'cp_test_apikey_xyz';

describe('refHash', () => {
  it('is deterministic across calls', async () => {
    const a = await refHash(KEY);
    const b = await refHash(KEY);
    expect(a).toBe(b);
  });

  it('is exactly 12 hex chars', async () => {
    const r = await refHash(KEY);
    expect(r).toMatch(/^[0-9a-f]{12}$/);
  });

  it('different keys produce different hashes', async () => {
    const a = await refHash(KEY);
    const b = await refHash(KEY + '_other');
    expect(a).not.toBe(b);
  });
});

describe('buildShare — twitter', () => {
  it('returns intent URL with encoded message and savings', async () => {
    const r = await buildShare('twitter', KEY, 12.34);
    expect(r.url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
    expect(r.message).toContain('$12.34');
    expect(r.message).toContain('@clawpipe');
    expect(r.savings).toBe(12.34);
    // URL has the ref
    const ref = await refHash(KEY);
    expect(decodeURIComponent(r.url)).toContain(`?ref=${ref}`);
  });
});

describe('buildShare — slack', () => {
  it('returns markdown message and url', async () => {
    const r = await buildShare('slack', KEY, 99);
    expect(r.message).toContain('*ClawPipe savings update*');
    expect(r.message).toContain('$99.00');
    expect(r.url).toMatch(/^https:\/\/clawpipe\.ai\/\?ref=/);
    expect(r.savings).toBe(99);
  });
});

describe('buildShare — email', () => {
  it('returns mailto URL with encoded subject and body', async () => {
    const r = await buildShare('email', KEY, 5);
    expect(r.url.startsWith('mailto:?subject=')).toBe(true);
    expect(decodeURIComponent(r.url)).toContain('I saved $5.00 on AI costs');
    expect(r.message).toContain('$5.00');
    expect(r.savings).toBe(5);
  });
});

describe('buildShare — url', () => {
  it('returns bare ref URL', async () => {
    const r = await buildShare('url', KEY, 0);
    const ref = await refHash(KEY);
    expect(r.url).toBe(`https://clawpipe.ai/?ref=${ref}`);
    expect(r.message).toBe(r.url);
    expect(r.savings).toBe(0);
  });
});

describe('buildShare — savings rounding', () => {
  it('formats fractional cents to 2 decimals', async () => {
    const r = await buildShare('twitter', KEY, 1.23456);
    expect(r.message).toContain('$1.23');
    expect(r.message).not.toContain('1.23456');
  });
});
