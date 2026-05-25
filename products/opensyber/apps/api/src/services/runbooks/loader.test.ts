import { describe, it, expect } from 'vitest';
import {
  parseRunbook,
  loadRunbooks,
  findRunbook,
  matchesTrigger,
  findMatchingRunbooks,
} from './loader.js';

const validRunbook = {
  id: 'r1',
  name: 'Test Runbook',
  trigger: { type: 'phishing' },
  steps: [
    { id: 's1', action: 'call_skill', params: {} },
    { id: 's2', action: 'notify', params: { channel: 'soc' } },
  ],
};

describe('runbook loader: parseRunbook', () => {
  it('accepts a valid definition and applies defaults', () => {
    const rb = parseRunbook(validRunbook);
    expect(rb.id).toBe('r1');
    expect(rb.steps).toHaveLength(2);
    expect(rb.steps[0].on_error).toEqual({ mode: 'fail' });
    expect(rb.steps[0].params).toEqual({});
  });

  it('rejects missing id', () => {
    expect(() => parseRunbook({ ...validRunbook, id: '' })).toThrow(/Invalid runbook/);
  });

  it('rejects empty steps array', () => {
    expect(() => parseRunbook({ ...validRunbook, steps: [] })).toThrow(/Invalid runbook/);
  });

  it('rejects step missing action', () => {
    expect(() => parseRunbook({
      ...validRunbook,
      steps: [{ id: 's1', params: {} }],
    })).toThrow(/Invalid runbook/);
  });

  it('rejects unknown on_error mode', () => {
    expect(() => parseRunbook({
      ...validRunbook,
      steps: [{ id: 's1', action: 'notify', on_error: { mode: 'oops' } }],
    })).toThrow(/Invalid runbook/);
  });
});

describe('runbook loader: loadRunbooks', () => {
  it('loads built-in registry without throwing (phishing-triage ships)', () => {
    const registry = loadRunbooks();
    expect(registry.length).toBeGreaterThan(0);
    expect(registry.some((rb) => rb.id === 'phishing-triage')).toBe(true);
  });

  it('loads from a caller-provided list', () => {
    const registry = loadRunbooks([validRunbook]);
    expect(registry).toHaveLength(1);
    expect(registry[0].id).toBe('r1');
  });

  it('throws if any source is invalid', () => {
    expect(() => loadRunbooks([validRunbook, { id: '' }])).toThrow(/Invalid runbook/);
  });
});

describe('runbook loader: findRunbook', () => {
  it('returns the matching runbook', () => {
    const registry = loadRunbooks([validRunbook]);
    expect(findRunbook('r1', registry)?.id).toBe('r1');
  });

  it('returns undefined when missing', () => {
    expect(findRunbook('nope', loadRunbooks([validRunbook]))).toBeUndefined();
  });
});

describe('runbook loader: trigger matching', () => {
  const rb = parseRunbook(validRunbook);

  it('matchesTrigger returns true on shallow equality', () => {
    expect(matchesTrigger(rb, { type: 'phishing', other: 'x' })).toBe(true);
  });

  it('matchesTrigger returns false when a key differs', () => {
    expect(matchesTrigger(rb, { type: 'malware' })).toBe(false);
  });

  it('matchesTrigger returns true for empty spec on any event', () => {
    const empty = parseRunbook({ ...validRunbook, trigger: {} });
    expect(matchesTrigger(empty, { whatever: 1 })).toBe(true);
  });

  it('findMatchingRunbooks skips empty trigger specs', () => {
    const empty = parseRunbook({ ...validRunbook, id: 'r2', trigger: {} });
    const registry = [rb, empty];
    const matches = findMatchingRunbooks({ type: 'phishing' }, registry);
    expect(matches.map((m) => m.id)).toEqual(['r1']);
  });
});
