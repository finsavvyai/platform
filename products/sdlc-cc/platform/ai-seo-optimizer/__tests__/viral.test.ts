import { describe, it, expect } from 'vitest';
import {
  generateViralMessage,
  getRegenerateQuip,
  getScoreEmoji,
  getScoreVerdict,
} from '../lib/viral';

describe('generateViralMessage', () => {
  it('returns a string', () => {
    expect(typeof generateViralMessage(80)).toBe('string');
  });

  it('includes the score in the message', () => {
    const msg = generateViralMessage(73);
    expect(msg).toContain('73');
  });

  it('generates different tiers for different scores', () => {
    const high = generateViralMessage(90);
    const low = generateViralMessage(20);
    // High score messages shouldn't contain self-deprecating language
    expect(high).not.toContain('doesn\'t know I exist');
    // Low score messages shouldn't brag
    expect(low).not.toContain('LIKE my content');
  });

  it('generates non-empty messages across score range', () => {
    for (let score = 0; score <= 100; score += 10) {
      const msg = generateViralMessage(score);
      expect(msg.length).toBeGreaterThan(20);
      expect(msg).toContain(String(score));
    }
  });
});

describe('getRegenerateQuip', () => {
  it('returns a string', () => {
    expect(typeof getRegenerateQuip()).toBe('string');
  });

  it('returns non-empty string', () => {
    expect(getRegenerateQuip().length).toBeGreaterThan(0);
  });
});

describe('getScoreEmoji', () => {
  it('returns fire for 90+', () => {
    expect(getScoreEmoji(95)).toBe('🔥');
  });

  it('returns flexed arm for 75-89', () => {
    expect(getScoreEmoji(80)).toBe('💪');
  });

  it('returns skull for 30-44', () => {
    expect(getScoreEmoji(35)).toBe('💀');
  });

  it('returns tombstone for sub-30', () => {
    expect(getScoreEmoji(15)).toBe('🪦');
  });
});

describe('getScoreVerdict', () => {
  it('returns positive verdict for high scores', () => {
    expect(getScoreVerdict(92)).toContain('LOVE');
  });

  it('returns negative verdict for low scores', () => {
    expect(getScoreVerdict(20)).toContain('deceased');
  });

  it('returns middle verdict for medium scores', () => {
    expect(getScoreVerdict(55)).toContain('ghosted');
  });
});
