import { describe, it, expect } from 'vitest';
import { projectSavings, recommendTier, fmtUsd } from './roi.js';

describe('projectSavings()', () => {
  const allOpenAI = { openai: 1, anthropic: 0, other: 0 };
  const mixed = { openai: 0.6, anthropic: 0.3, other: 0.1 };
  const noOpenAI = { openai: 0, anthropic: 0, other: 1 };

  it('chatbot use case with $1000 spend', () => {
    const r = projectSavings(1000, mixed, 'chatbot');
    expect(r.boosterSavings).toBe(150);
    expect(r.cacheSavings).toBe(250);
    expect(r.totalSavings).toBeGreaterThan(0);
    expect(r.totalPercent).toBeLessThanOrEqual(60);
  });

  it('rag use case — high cache savings', () => {
    const r = projectSavings(1000, mixed, 'rag');
    expect(r.cacheSavings).toBe(400);
    expect(r.totalPercent).toBeLessThanOrEqual(60);
  });

  it('code use case', () => {
    const r = projectSavings(1000, mixed, 'code');
    expect(r.boosterSavings).toBe(200);
    expect(r.cacheSavings).toBe(100);
  });

  it('general use case', () => {
    const r = projectSavings(1000, mixed, 'general');
    expect(r.boosterSavings).toBe(100);
    expect(r.cacheSavings).toBe(200);
  });

  it('zero spend returns all zeros', () => {
    const r = projectSavings(0, mixed, 'chatbot');
    expect(r.totalSavings).toBe(0);
    expect(r.totalPercent).toBe(0);
  });

  it('totalPercent never exceeds 60', () => {
    const r = projectSavings(1000, allOpenAI, 'rag');
    expect(r.totalPercent).toBeLessThanOrEqual(60);
  });

  it('all-openai mix increases routing savings vs no-openai mix', () => {
    const rHigh = projectSavings(1000, allOpenAI, 'chatbot');
    const rLow = projectSavings(1000, noOpenAI, 'chatbot');
    expect(rHigh.routingSavings).toBeGreaterThan(rLow.routingSavings);
  });

  it('returns dollar amounts to 2 decimal places', () => {
    const r = projectSavings(333, mixed, 'chatbot');
    expect(r.boosterSavings.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it('large spend — total capped at 60%', () => {
    const r = projectSavings(100000, allOpenAI, 'rag');
    expect(r.totalSavings).toBe(60000);
  });
});

describe('recommendTier()', () => {
  it('returns Dev for savings below $100', () => {
    expect(recommendTier(50).slug).toBe('dev');
  });

  it('returns Dev for savings $100–$500', () => {
    expect(recommendTier(300).slug).toBe('dev');
  });

  it('returns Growth for savings $500–$2000', () => {
    expect(recommendTier(1000).slug).toBe('growth');
  });

  it('returns Scale for savings > $2000', () => {
    expect(recommendTier(3000).slug).toBe('scale');
  });
});

describe('fmtUsd()', () => {
  it('formats zero', () => { expect(fmtUsd(0)).toBe('$0'); });
  it('formats thousands', () => { expect(fmtUsd(1500)).toBe('$1,500'); });
  it('formats small amount', () => { expect(fmtUsd(79)).toBe('$79'); });
});
