import { describe, it, expect } from 'vitest';
import {
  scoreSignal,
  analyzeStructure,
  analyzeAuthority,
  analyzeAiReadiness,
  analyzeTechnical,
  calculateOverallScore,
  calculateAgentScores,
  generateSummary,
} from '../lib/scoring';
import type { PageMeta } from '../lib/scoring';

const fullMeta: PageMeta = {
  hasH1: true, headingDepth: 3, hasSchema: true, hasFAQ: true,
  wordCount: 2000, hasStatistics: true, hasCitations: true,
  hasAuthor: true, hasDate: true, hasShortParagraphs: true,
  hasDefinitions: true, hasTables: true, hasLists: true,
  hasMetaDesc: true, hasCanonical: true, hasLlmsTxt: true,
  allowsAiCrawlers: true,
};

const emptyMeta: PageMeta = {
  hasH1: false, headingDepth: 0, hasSchema: false, hasFAQ: false,
  wordCount: 100, hasStatistics: false, hasCitations: false,
  hasAuthor: false, hasDate: false, hasShortParagraphs: false,
  hasDefinitions: false, hasTables: false, hasLists: false,
  hasMetaDesc: false, hasCanonical: false, hasLlmsTxt: false,
  allowsAiCrawlers: false,
};

describe('scoreSignal', () => {
  it('returns pass for boolean true', () => {
    const result = scoreSignal('Test', true, 10, 'rec');
    expect(result.score).toBe(10);
    expect(result.status).toBe('pass');
  });

  it('returns fail for boolean false', () => {
    const result = scoreSignal('Test', false, 10, 'rec');
    expect(result.score).toBe(0);
    expect(result.status).toBe('fail');
  });

  it('returns warn for mid-range numeric', () => {
    const result = scoreSignal('Test', 5, 10, 'rec');
    expect(result.score).toBe(5);
    expect(result.status).toBe('warn');
  });

  it('caps score at maxScore', () => {
    const result = scoreSignal('Test', 15, 10, 'rec');
    expect(result.score).toBe(10);
  });
});

describe('analyzeStructure', () => {
  it('returns 4 signals', () => {
    expect(analyzeStructure(fullMeta)).toHaveLength(4);
  });

  it('scores high for complete meta', () => {
    const signals = analyzeStructure(fullMeta);
    const total = signals.reduce((s, sig) => s + sig.score, 0);
    const max = signals.reduce((s, sig) => s + sig.maxScore, 0);
    expect(total / max).toBeGreaterThan(0.7);
  });
});

describe('analyzeAuthority', () => {
  it('returns 4 signals', () => {
    expect(analyzeAuthority(fullMeta)).toHaveLength(4);
  });

  it('scores low for empty meta', () => {
    const signals = analyzeAuthority(emptyMeta);
    const total = signals.reduce((s, sig) => s + sig.score, 0);
    const max = signals.reduce((s, sig) => s + sig.maxScore, 0);
    expect(total / max).toBeLessThan(0.5);
  });
});

describe('analyzeAiReadiness', () => {
  it('returns 4 signals', () => {
    expect(analyzeAiReadiness(fullMeta)).toHaveLength(4);
  });
});

describe('analyzeTechnical', () => {
  it('returns 4 signals', () => {
    expect(analyzeTechnical(fullMeta)).toHaveLength(4);
  });
});

describe('calculateOverallScore', () => {
  it('returns 100 for max scores', () => {
    const signals = [
      scoreSignal('A', true, 50, ''),
      scoreSignal('B', true, 50, ''),
    ];
    expect(calculateOverallScore(signals)).toBe(100);
  });

  it('returns 0 for zero scores', () => {
    const signals = [
      scoreSignal('A', false, 50, ''),
      scoreSignal('B', false, 50, ''),
    ];
    expect(calculateOverallScore(signals)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(calculateOverallScore([])).toBe(0);
  });
});

describe('calculateAgentScores', () => {
  it('returns 4 agents', () => {
    expect(calculateAgentScores(80)).toHaveLength(4);
  });

  it('includes expected agent names', () => {
    const names = calculateAgentScores(80).map((a) => a.agent);
    expect(names).toContain('ChatGPT');
    expect(names).toContain('Perplexity');
    expect(names).toContain('Claude');
    expect(names).toContain('Gemini');
  });

  it('assigns citation likelihood based on score', () => {
    const scores = calculateAgentScores(90);
    scores.forEach((s) => {
      if (s.score >= 75) expect(s.citationLikelihood).toBe('high');
    });
  });
});

describe('generateSummary', () => {
  it('returns strong message for high score', () => {
    expect(generateSummary(85, 1)).toContain('Strong');
  });

  it('returns moderate message for mid score', () => {
    expect(generateSummary(60, 3)).toContain('Moderate');
  });

  it('returns low message for low score', () => {
    expect(generateSummary(30, 8)).toContain('Low');
  });
});
