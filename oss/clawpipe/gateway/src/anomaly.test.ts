/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  parseFiredDates, alreadyFiredToday, formatAnomalyBlocks, formatAnomalyEmail,
  type AnomalyStatus,
} from './anomaly';

const status: AnomalyStatus = {
  todayUsd: 120, avg30dUsd: 40, multiplier: 3, threshold: 2, alert: true,
};

describe('parseFiredDates', () => {
  it('returns [] on null/empty', () => {
    expect(parseFiredDates(null)).toEqual([]);
    expect(parseFiredDates('')).toEqual([]);
  });
  it('parses valid JSON array', () => {
    expect(parseFiredDates('["2026-04-23","2026-04-24"]')).toEqual(['2026-04-23', '2026-04-24']);
  });
  it('returns [] on malformed JSON', () => {
    expect(parseFiredDates('not json')).toEqual([]);
  });
  it('filters non-string entries', () => {
    expect(parseFiredDates('["2026-04-24", 42, null]')).toEqual(['2026-04-24']);
  });
  it('returns [] for non-array JSON', () => {
    expect(parseFiredDates('{"date":"2026-04-24"}')).toEqual([]);
  });
});

describe('alreadyFiredToday', () => {
  it('is true when today is in the list', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(alreadyFiredToday([today])).toBe(true);
  });
  it('is false when only other dates present', () => {
    expect(alreadyFiredToday(['2020-01-01'])).toBe(false);
  });
  it('is false for empty list', () => {
    expect(alreadyFiredToday([])).toBe(false);
  });
});

describe('formatAnomalyBlocks', () => {
  it('includes project name and multiplier in text', () => {
    const p = formatAnomalyBlocks('my-app', status) as { text: string };
    expect(p.text).toContain('my-app');
    expect(p.text).toContain('3×');
  });
  it('shows today and avg as section fields', () => {
    const serial = JSON.stringify(formatAnomalyBlocks('x', status));
    expect(serial).toContain('$120.00');
    expect(serial).toContain('$40.00');
  });
  it('uses header + section + context block types', () => {
    const p = formatAnomalyBlocks('x', status) as { blocks: Array<{ type: string }> };
    const types = p.blocks.map((b) => b.type);
    expect(types).toContain('header');
    expect(types).toContain('section');
    expect(types).toContain('context');
  });
});

describe('formatAnomalyEmail', () => {
  it('puts multiplier in subject', () => {
    expect(formatAnomalyEmail('x', status).subject).toContain('3×');
  });
  it('shows today + 30-day avg in body', () => {
    const msg = formatAnomalyEmail('x', status);
    expect(msg.text).toContain('$120.00');
    expect(msg.text).toContain('$40.00');
    expect(msg.html).toContain('$120.00');
    expect(msg.html).toContain('$40.00');
  });
});
