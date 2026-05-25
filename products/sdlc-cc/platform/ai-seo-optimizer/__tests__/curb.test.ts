import { describe, it, expect } from 'vitest';
import {
  getCurbEpisodeTitle,
  getCurbMonologue,
  getCurbShareText,
} from '../lib/curb';

describe('getCurbEpisodeTitle', () => {
  it('returns a string', () => {
    expect(typeof getCurbEpisodeTitle(80)).toBe('string');
  });

  it('returns non-empty for all tiers', () => {
    expect(getCurbEpisodeTitle(90).length).toBeGreaterThan(0);
    expect(getCurbEpisodeTitle(55).length).toBeGreaterThan(0);
    expect(getCurbEpisodeTitle(20).length).toBeGreaterThan(0);
  });

  it('returns different styles per tier', () => {
    const highTitles = new Set(Array.from({ length: 20 }, () => getCurbEpisodeTitle(90)));
    const lowTitles = new Set(Array.from({ length: 20 }, () => getCurbEpisodeTitle(15)));
    // Should have variation
    expect(highTitles.size).toBeGreaterThan(1);
    expect(lowTitles.size).toBeGreaterThan(1);
  });
});

describe('getCurbMonologue', () => {
  it('returns a non-empty string', () => {
    const monologue = getCurbMonologue(70);
    expect(typeof monologue).toBe('string');
    expect(monologue.length).toBeGreaterThan(50);
  });

  it('includes the score in the monologue', () => {
    const monologue = getCurbMonologue(42);
    expect(monologue).toContain('42');
  });

  it('generates different monologues for different score tiers', () => {
    const high = getCurbMonologue(85);
    const low = getCurbMonologue(20);
    expect(high).not.toBe(low);
  });

  it('has conversational Larry David tone', () => {
    const monologue = getCurbMonologue(50);
    // Should contain conversational markers
    const hasConversational = /you know|I |my /i.test(monologue);
    expect(hasConversational).toBe(true);
  });
});

describe('getCurbShareText', () => {
  it('includes curb theme reference', () => {
    const text = getCurbShareText(80, 'The 80 Percenter');
    expect(text.toLowerCase()).toContain('curb');
  });

  it('includes episode title', () => {
    const text = getCurbShareText(60, 'The Mediocre Content');
    expect(text).toContain('The Mediocre Content');
  });

  it('includes score', () => {
    const text = getCurbShareText(73, 'Some Episode');
    expect(text).toContain('73');
  });

  it('includes season/episode format', () => {
    const text = getCurbShareText(50, 'Test');
    expect(text).toContain('S12E50');
  });

  it('returns different tone for different tiers', () => {
    const high = getCurbShareText(90, 'Title');
    const low = getCurbShareText(20, 'Title');
    expect(high).toContain('pretty');
    expect(low).toContain('restraining order');
  });
});
