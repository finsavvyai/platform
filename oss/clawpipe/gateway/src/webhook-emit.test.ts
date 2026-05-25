/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { signPayload, eventsMatch } from './webhook-emit';

describe('signPayload', () => {
  it('produces sha256=<hex> prefix', async () => {
    const sig = await signPayload('secret', '{"x":1}');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('is deterministic for identical inputs', async () => {
    const a = await signPayload('k', 'payload');
    const b = await signPayload('k', 'payload');
    expect(a).toBe(b);
  });

  it('changes when payload changes', async () => {
    const a = await signPayload('k', 'a');
    const b = await signPayload('k', 'b');
    expect(a).not.toBe(b);
  });

  it('changes when secret changes', async () => {
    const a = await signPayload('k1', 'p');
    const b = await signPayload('k2', 'p');
    expect(a).not.toBe(b);
  });
});

describe('eventsMatch', () => {
  it('matches exact event name', () => {
    expect(eventsMatch('budget.threshold.crossed', 'budget.threshold.crossed')).toBe(true);
  });
  it('matches one entry in CSV list', () => {
    expect(eventsMatch('anomaly.detected,digest.sent', 'digest.sent')).toBe(true);
  });
  it('handles whitespace in CSV', () => {
    expect(eventsMatch('anomaly.detected,  digest.sent', 'digest.sent')).toBe(true);
  });
  it('returns true for * wildcard', () => {
    expect(eventsMatch('*', 'anomaly.detected')).toBe(true);
  });
  it('returns false for non-matching event', () => {
    expect(eventsMatch('digest.sent', 'anomaly.detected')).toBe(false);
  });
});
