import { describe, it, expect } from 'vitest';
import {
  evaluateAitm,
  aitmScoreDelta,
  type ClientFingerprint,
} from './aitm-heuristics.js';

const cleanBaseline: ClientFingerprint = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  language: 'en-US',
  timezone: 'America/Los_Angeles',
  colorDepth: 24,
  screenWidth: 1920,
  screenHeight: 1080,
  origin: 'https://app.example.com',
  sni: 'app.example.com',
  host: 'app.example.com',
  rttMs: 12,
  channelBound: true,
};

describe('evaluateAitm', () => {
  it('returns empty when current matches baseline', () => {
    expect(evaluateAitm(cleanBaseline, cleanBaseline)).toEqual([]);
  });

  it('flags origin/SNI/host mismatch as high confidence', () => {
    const cur: ClientFingerprint = {
      ...cleanBaseline,
      origin: 'https://phish.example',
      sni: 'app.example.com',
      host: 'app.example.com',
    };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'origin_mismatch', confidence: 'high' });
  });

  it('does not flag origin mismatch when triple is internally consistent', () => {
    const cur: ClientFingerprint = { ...cleanBaseline, origin: 'https://app.example.com' };
    expect(evaluateAitm(cleanBaseline, cur)).toEqual([]);
  });

  it('skips origin check entirely when any of origin/sni/host is absent', () => {
    const cur: ClientFingerprint = { ...cleanBaseline, origin: undefined, sni: undefined };
    expect(evaluateAitm(cleanBaseline, cur)).toEqual([]);
  });

  it('flags UA drift as high confidence', () => {
    const cur = { ...cleanBaseline, userAgent: 'curl/8.0' };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'ua_drift', confidence: 'high' }),
    );
  });

  it('flags timezone drift as medium', () => {
    const cur = { ...cleanBaseline, timezone: 'Europe/Berlin' };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'tz_drift', confidence: 'medium' }),
    );
  });

  it('flags locale drift as medium', () => {
    const cur = { ...cleanBaseline, language: 'ru-RU' };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'locale_drift', confidence: 'medium' }),
    );
  });

  it('flags color-depth drift as low', () => {
    const cur = { ...cleanBaseline, colorDepth: 16 };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'color_drift', confidence: 'low' }),
    );
  });

  it('flags resolution swap as medium', () => {
    const cur = { ...cleanBaseline, screenWidth: 1080, screenHeight: 1920 };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'resolution_swap', confidence: 'medium' }),
    );
  });

  it('does not flag resolution swap when dimensions are square', () => {
    const sqBase = { ...cleanBaseline, screenWidth: 1024, screenHeight: 1024 };
    const result = evaluateAitm(sqBase, sqBase);
    expect(result.find((a) => a.kind === 'resolution_swap')).toBeUndefined();
  });

  it('flags latency floor delta above default 40ms', () => {
    const cur = { ...cleanBaseline, rttMs: 60 };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({
        kind: 'latency_floor',
        confidence: 'medium',
      }),
    );
  });

  it('does not flag latency under threshold', () => {
    const cur = { ...cleanBaseline, rttMs: 30 };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toEqual([]);
  });

  it('honours custom rttFloorDeltaMs threshold', () => {
    const cur = { ...cleanBaseline, rttMs: 40 };
    const result = evaluateAitm(cleanBaseline, cur, { rttFloorDeltaMs: 20 });
    expect(result.some((a) => a.kind === 'latency_floor')).toBe(true);
  });

  it('flags missing channel binding when required', () => {
    const cur = { ...cleanBaseline, channelBound: false };
    const result = evaluateAitm(cleanBaseline, cur);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'channel_unbound', confidence: 'high' }),
    );
  });

  it('does not flag channel binding when caller opts out', () => {
    const cur = { ...cleanBaseline, channelBound: false };
    const result = evaluateAitm(cleanBaseline, cur, { requireChannelBinding: false });
    expect(result).toEqual([]);
  });

  it('reports multiple anomalies on a fully drifted session', () => {
    const cur = {
      ...cleanBaseline,
      userAgent: 'attacker',
      timezone: 'Europe/Moscow',
      language: 'ru-RU',
      rttMs: 80,
      origin: 'https://phish.example',
    };
    const result = evaluateAitm(cleanBaseline, cur);
    const kinds = new Set(result.map((a) => a.kind));
    expect(kinds.has('ua_drift')).toBe(true);
    expect(kinds.has('tz_drift')).toBe(true);
    expect(kinds.has('locale_drift')).toBe(true);
    expect(kinds.has('latency_floor')).toBe(true);
    expect(kinds.has('origin_mismatch')).toBe(true);
  });

  it('malformed origin URL falls through safeHost catch (line 181) without crashing — defensive fallback', () => {
    // safeHost throws on invalid URL → undefined → [sni, host].filter → allMatch=true → no origin_mismatch.
    // 'foo bar' (space inside) makes new URL() throw "Invalid URL".
    const cur: ClientFingerprint = {
      ...cleanBaseline, origin: 'foo bar',
      sni: 'app.example.com', host: 'app.example.com',
    };
    expect(() => evaluateAitm(cleanBaseline, cur)).not.toThrow();
    expect(evaluateAitm(cleanBaseline, cur).find((a) => a.kind === 'origin_mismatch')).toBeUndefined();
  });
});

describe('aitmScoreDelta', () => {
  it('returns 0 when there are no anomalies', () => {
    expect(aitmScoreDelta([])).toBe(0);
  });

  it('subtracts 25 per high-confidence anomaly', () => {
    expect(aitmScoreDelta([{ kind: 'ua_drift', confidence: 'high' }])).toBe(-25);
  });

  it('subtracts 12 per medium-confidence anomaly', () => {
    expect(aitmScoreDelta([{ kind: 'tz_drift', confidence: 'medium' }])).toBe(-12);
  });

  it('subtracts 5 per low-confidence anomaly', () => {
    expect(aitmScoreDelta([{ kind: 'color_drift', confidence: 'low' }])).toBe(-5);
  });

  it('caps at -60 even on a fully drifted session', () => {
    const anoms = [
      { kind: 'ua_drift', confidence: 'high' as const },
      { kind: 'origin_mismatch', confidence: 'high' as const },
      { kind: 'channel_unbound', confidence: 'high' as const },
      { kind: 'tz_drift', confidence: 'medium' as const },
      { kind: 'latency_floor', confidence: 'medium' as const },
    ];
    expect(aitmScoreDelta(anoms)).toBe(-60);
  });

  it('does not apply the cap when total stays above -60', () => {
    expect(
      aitmScoreDelta([
        { kind: 'tz_drift', confidence: 'medium' },
        { kind: 'tz_drift', confidence: 'medium' },
      ]),
    ).toBe(-24);
  });
});
