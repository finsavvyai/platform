import { describe, it, expect } from 'vitest';
import {
  parseStepUpActions,
  evaluateStepUpPolicy,
  type StepUpAction,
} from './step-up-policy.js';

const json = (data: unknown): string => JSON.stringify(data);

describe('parseStepUpActions', () => {
  it('parses a valid actions array', () => {
    const raw = json([
      { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 60 },
      { path: '/admin/*', requireWebAuthn: true },
    ]);
    const out = parseStepUpActions(raw);
    expect(out).toHaveLength(2);
    expect(out![0]!.path).toBe('/checkout');
    expect(out![1]!.requireWebAuthn).toBe(true);
  });

  it('rejects non-JSON input', () => {
    expect(parseStepUpActions('{not-json')).toBeNull();
  });

  it('rejects when top level is not an array', () => {
    expect(parseStepUpActions(json({ path: '/a' }))).toBeNull();
  });

  it('rejects when array has more than 50 entries (DoS guard)', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ path: `/p${i}` }));
    expect(parseStepUpActions(json(tooMany))).toBeNull();
  });

  it('rejects entries without a path', () => {
    expect(parseStepUpActions(json([{ requireFreshSig: true }]))).toBeNull();
  });

  it('rejects entries with non-string path', () => {
    expect(parseStepUpActions(json([{ path: 42 }]))).toBeNull();
  });

  it('rejects entries with empty path', () => {
    expect(parseStepUpActions(json([{ path: '' }]))).toBeNull();
  });

  it('rejects entries with path longer than 256 chars (header bloat)', () => {
    expect(parseStepUpActions(json([{ path: 'a'.repeat(257) }]))).toBeNull();
  });

  it('rejects non-boolean requireFreshSig', () => {
    expect(parseStepUpActions(json([{ path: '/a', requireFreshSig: 'yes' }]))).toBeNull();
  });

  it('rejects non-integer freshSigMaxAgeSec', () => {
    expect(parseStepUpActions(json([{ path: '/a', freshSigMaxAgeSec: 60.5 }]))).toBeNull();
  });

  it('rejects freshSigMaxAgeSec below 5 or above 600 (range guard)', () => {
    expect(parseStepUpActions(json([{ path: '/a', freshSigMaxAgeSec: 4 }]))).toBeNull();
    expect(parseStepUpActions(json([{ path: '/a', freshSigMaxAgeSec: 601 }]))).toBeNull();
  });

  it('rejects non-boolean requireWebAuthn', () => {
    expect(parseStepUpActions(json([{ path: '/a', requireWebAuthn: 1 }]))).toBeNull();
  });

  it('accepts the empty array (a valid "no policies" config)', () => {
    expect(parseStepUpActions('[]')).toEqual([]);
  });
});

describe('evaluateStepUpPolicy', () => {
  const actions: StepUpAction[] = [
    { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 60 },
    { path: '/admin/*', requireFreshSig: true, freshSigMaxAgeSec: 30, requireWebAuthn: true },
    { path: '/admin/billing/*', requireFreshSig: true, freshSigMaxAgeSec: 10 },
    { path: '/health', requireFreshSig: false, requireWebAuthn: false },
  ];

  it('returns the default verdict when no rule matches', () => {
    const v = evaluateStepUpPolicy(actions, '/api/anything');
    expect(v.matched).toBe(false);
    expect(v.requireFreshSig).toBe(false);
    expect(v.requireWebAuthn).toBe(false);
    expect(v.freshSigMaxAgeSec).toBe(60);
  });

  it('matches exact paths first', () => {
    const v = evaluateStepUpPolicy(actions, '/checkout');
    expect(v).toEqual({
      matched: true, requireFreshSig: true, freshSigMaxAgeSec: 60, requireWebAuthn: false,
    });
  });

  it('matches glob-prefix when no exact match', () => {
    const v = evaluateStepUpPolicy(actions, '/admin/users');
    expect(v.matched).toBe(true);
    expect(v.requireFreshSig).toBe(true);
    expect(v.freshSigMaxAgeSec).toBe(30);
    expect(v.requireWebAuthn).toBe(true);
  });

  it('longest matching glob-prefix wins (specific over general)', () => {
    const v = evaluateStepUpPolicy(actions, '/admin/billing/refund');
    expect(v.matched).toBe(true);
    expect(v.freshSigMaxAgeSec).toBe(10); // /admin/billing/* (longer) wins over /admin/*
  });

  it('exact match beats a glob that would also match', () => {
    const cfg: StepUpAction[] = [
      { path: '/admin/*', requireFreshSig: true, freshSigMaxAgeSec: 30 },
      { path: '/admin/dashboard', requireFreshSig: false, freshSigMaxAgeSec: 600 },
    ];
    const v = evaluateStepUpPolicy(cfg, '/admin/dashboard');
    expect(v.requireFreshSig).toBe(false);
    expect(v.freshSigMaxAgeSec).toBe(600);
  });

  it('respects a config that explicitly turns off step-up on a sensitive-looking path', () => {
    const v = evaluateStepUpPolicy(actions, '/health');
    expect(v.matched).toBe(true);
    expect(v.requireFreshSig).toBe(false);
    expect(v.requireWebAuthn).toBe(false);
  });

  it('returns the default verdict for an empty actions array', () => {
    const v = evaluateStepUpPolicy([], '/checkout');
    expect(v.matched).toBe(false);
    expect(v.requireFreshSig).toBe(false);
  });

  it('does not partial-prefix-match without a trailing star (e.g. /admin should not match /admin/users)', () => {
    const cfg: StepUpAction[] = [
      { path: '/admin', requireFreshSig: true, freshSigMaxAgeSec: 30 },
    ];
    const v = evaluateStepUpPolicy(cfg, '/admin/users');
    expect(v.matched).toBe(false);
  });
});
