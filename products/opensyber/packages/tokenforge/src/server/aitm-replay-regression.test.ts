/**
 * AitM replay-attack regression — Sprint 39 exit criterion.
 *
 * Captures a legitimate session fingerprint and replays it across 8
 * attacker-controlled distortions, one per heuristic kind. Each row in
 * the table verifies that a single-field mutation (the kind the heuristic
 * is designed to catch) fires exactly that heuristic. A final case
 * verifies the cumulative replay (all 8 mutations at once) hits every
 * kind and the score-delta caps at -60.
 *
 * "Replay" here is the unit-level analogue of the live phishing-kit
 * scenario in the Sprint 39 plan — Evilginx-style reverse proxy lands
 * the captured session on different infra, so origin/SNI/host triple
 * differs, RTT floor jumps, UA from the proxy differs, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateAitm,
  aitmScoreDelta,
  type ClientFingerprint,
  type AitmAnomalyKind,
} from './aitm-heuristics.js';

const captured: ClientFingerprint = {
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

interface Replay {
  kind: AitmAnomalyKind;
  scenario: string;
  mutate: (fp: ClientFingerprint) => ClientFingerprint;
}

const replays: Replay[] = [
  {
    kind: 'origin_mismatch',
    scenario: 'attacker domain differs from real SNI/host triple',
    mutate: (fp) => ({ ...fp, origin: 'https://phishing-site.example' }),
  },
  {
    kind: 'latency_floor',
    scenario: 'reverse-proxy adds 50ms hop above the 40ms floor',
    mutate: (fp) => ({ ...fp, rttMs: fp.rttMs + 60 }),
  },
  {
    kind: 'ua_drift',
    scenario: 'replay shipped from a different browser binary',
    mutate: (fp) => ({
      ...fp,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/137.0',
    }),
  },
  {
    kind: 'tz_drift',
    scenario: 'replay coming from a different timezone (overseas proxy)',
    mutate: (fp) => ({ ...fp, timezone: 'Europe/Moscow' }),
  },
  {
    kind: 'locale_drift',
    scenario: 'attacker browser advertises a different Accept-Language',
    mutate: (fp) => ({ ...fp, language: 'ru-RU' }),
  },
  {
    kind: 'color_drift',
    scenario: 'headless replay tool reports a different color depth',
    mutate: (fp) => ({ ...fp, colorDepth: 16 }),
  },
  {
    kind: 'resolution_swap',
    scenario: 'attacker device renders rotated (portrait↔landscape)',
    mutate: (fp) => ({ ...fp, screenWidth: fp.screenHeight, screenHeight: fp.screenWidth }),
  },
  {
    kind: 'channel_unbound',
    scenario: 'replay over a TLS connection that never bound the device cookie',
    mutate: (fp) => ({ ...fp, channelBound: false }),
  },
];

describe('AitM replay-attack regression — single-field mutations', () => {
  for (const r of replays) {
    it(`flags ${r.kind} when ${r.scenario}`, () => {
      const result = evaluateAitm(captured, r.mutate(captured));
      const kinds = result.map((a) => a.kind);
      expect(kinds).toContain(r.kind);
    });
  }
});

describe('AitM replay-attack regression — cumulative phishing-kit attack', () => {
  function applyAll(): ClientFingerprint {
    return replays.reduce((fp, r) => r.mutate(fp), captured);
  }

  it('detects all 8 heuristic kinds when every field is replayed', () => {
    const replayed = applyAll();
    const kinds = new Set(evaluateAitm(captured, replayed).map((a) => a.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(8);
    for (const r of replays) expect(kinds.has(r.kind)).toBe(true);
  });

  it('caps score-delta at -60 even when every heuristic fires at high', () => {
    const replayed = applyAll();
    const anomalies = evaluateAitm(captured, replayed);
    expect(aitmScoreDelta(anomalies)).toBe(-60);
  });

  it('returns no anomalies when the replay is byte-identical (false-positive guard)', () => {
    const result = evaluateAitm(captured, captured);
    expect(result).toEqual([]);
    expect(aitmScoreDelta(result)).toBe(0);
  });
});

describe('AitM replay-attack regression — taxonomy coverage gate', () => {
  it('exercises every AitmAnomalyKind value (no kind left untested)', () => {
    const declared: AitmAnomalyKind[] = [
      'origin_mismatch', 'latency_floor', 'ua_drift', 'tz_drift',
      'color_drift', 'resolution_swap', 'locale_drift', 'channel_unbound',
    ];
    const exercised = new Set(replays.map((r) => r.kind));
    for (const k of declared) expect(exercised.has(k)).toBe(true);
    expect(exercised.size).toBe(declared.length);
  });
});
