import { describe, it, expect, vi } from 'vitest';
import { resolveStepUpVerdict } from './loader.js';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];

function makeDb(rows: Array<Record<string, unknown>>): DbLike {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => rows),
        })),
      })),
    })),
  } as unknown as DbLike;
}

describe('resolveStepUpVerdict', () => {
  it('returns the default verdict when tenant is missing', async () => {
    const v = await resolveStepUpVerdict(makeDb([]), 't_missing', '/checkout');
    expect(v).toEqual({
      matched: false, requireFreshSig: false, freshSigMaxAgeSec: 60, requireWebAuthn: false,
    });
  });

  it('returns the default verdict when stepUpActions column is null', async () => {
    const v = await resolveStepUpVerdict(makeDb([{ stepUpActions: null }]), 't1', '/checkout');
    expect(v.matched).toBe(false);
    expect(v.requireFreshSig).toBe(false);
  });

  it('returns the default verdict when stepUpActions JSON is malformed (no lockout)', async () => {
    const v = await resolveStepUpVerdict(
      makeDb([{ stepUpActions: '{not-json' }]),
      't1', '/checkout',
    );
    expect(v.matched).toBe(false);
  });

  it('matches an exact path from the configured policy', async () => {
    const policy = JSON.stringify([
      { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 30 },
    ]);
    const v = await resolveStepUpVerdict(makeDb([{ stepUpActions: policy }]), 't1', '/checkout');
    expect(v.matched).toBe(true);
    expect(v.requireFreshSig).toBe(true);
    expect(v.freshSigMaxAgeSec).toBe(30);
  });

  it('matches a glob path from the configured policy', async () => {
    const policy = JSON.stringify([
      { path: '/admin/*', requireFreshSig: true, requireWebAuthn: true, freshSigMaxAgeSec: 30 },
    ]);
    const v = await resolveStepUpVerdict(
      makeDb([{ stepUpActions: policy }]),
      't1', '/admin/users',
    );
    expect(v.matched).toBe(true);
    expect(v.requireWebAuthn).toBe(true);
  });

  it('returns default verdict when path matches nothing in the policy', async () => {
    const policy = JSON.stringify([
      { path: '/checkout', requireFreshSig: true },
    ]);
    const v = await resolveStepUpVerdict(makeDb([{ stepUpActions: policy }]), 't1', '/health');
    expect(v.matched).toBe(false);
    expect(v.requireFreshSig).toBe(false);
  });

  it('empty policy array → default verdict (matched=false) regardless of path', async () => {
    const v = await resolveStepUpVerdict(makeDb([{ stepUpActions: '[]' }]), 't1', '/checkout');
    expect(v.matched).toBe(false);
    expect(v.requireFreshSig).toBe(false);
    expect(v.freshSigMaxAgeSec).toBe(60);
  });

  it('exact-match entry wins over glob entry, regardless of array order', async () => {
    // Glob comes first in array; exact match still wins per evaluator semantics
    // (exact-match scan precedes glob-prefix scan in evaluateStepUpPolicy).
    const policy = JSON.stringify([
      { path: '/admin/*', requireFreshSig: true, freshSigMaxAgeSec: 15, requireWebAuthn: true },
      { path: '/admin/billing', requireFreshSig: true, freshSigMaxAgeSec: 30, requireWebAuthn: false },
    ]);
    const v = await resolveStepUpVerdict(
      makeDb([{ stepUpActions: policy }]), 't1', '/admin/billing',
    );
    expect(v.matched).toBe(true);
    expect(v.freshSigMaxAgeSec).toBe(30);
    expect(v.requireWebAuthn).toBe(false);
  });

  it('rejects entire policy when freshSigMaxAgeSec exceeds MAX_FRESH_SIG_SEC=600 (returns default)', async () => {
    const policy = JSON.stringify([
      { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 9999 },
    ]);
    const v = await resolveStepUpVerdict(makeDb([{ stepUpActions: policy }]), 't1', '/checkout');
    expect(v.matched).toBe(false);
    expect(v.freshSigMaxAgeSec).toBe(60); // back to DEFAULT_FRESH_SIG_MAX_AGE_SEC
  });

  it('glob /admin/* matches the single-segment /admin/users but NOT /admin (no segment)', async () => {
    const policy = JSON.stringify([{ path: '/admin/*', requireFreshSig: true }]);
    const matches = await resolveStepUpVerdict(makeDb([{ stepUpActions: policy }]), 't1', '/admin/users');
    expect(matches.matched).toBe(true);
    const noSegment = await resolveStepUpVerdict(makeDb([{ stepUpActions: policy }]), 't1', '/admin');
    expect(noSegment.matched).toBe(false);
  });

  it('exact-path policy does NOT match a trailing-slash variant', async () => {
    const policy = JSON.stringify([{ path: '/checkout', requireFreshSig: true }]);
    const v = await resolveStepUpVerdict(makeDb([{ stepUpActions: policy }]), 't1', '/checkout/');
    // /checkout/ has a trailing slash that /checkout does not. Non-glob exact
    // matching is character-strict. Documents the contract — clients must
    // normalize before policy lookup.
    expect(v.matched).toBe(false);
  });
});
