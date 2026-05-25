import { describe, it, expect } from 'vitest';
import {
  PERSONA_SUGGESTIONS,
  getSuggestionsForPersona,
  VERIFIED_SKILLS,
} from './skill-suggestions.js';
import { ALL_PERSONAS } from '../types/onboarding-profile.js';

describe('skill-suggestions', () => {
  it('every persona has a suggestion entry', () => {
    for (const persona of ALL_PERSONAS) {
      expect(PERSONA_SUGGESTIONS[persona]).toBeDefined();
    }
  });

  it('every suggestion has at least one skill', () => {
    for (const persona of ALL_PERSONAS) {
      expect(PERSONA_SUGGESTIONS[persona].skills.length).toBeGreaterThan(0);
    }
  });

  it('no suggestion exceeds 3 skills (v1 install ceiling)', () => {
    for (const persona of ALL_PERSONAS) {
      expect(PERSONA_SUGGESTIONS[persona].skills.length).toBeLessThanOrEqual(3);
    }
  });

  it('every suggested skill is in VERIFIED_SKILLS (no bluffing)', () => {
    const allowed: ReadonlySet<string> = new Set(Object.values(VERIFIED_SKILLS));
    for (const persona of ALL_PERSONAS) {
      for (const skill of PERSONA_SUGGESTIONS[persona].skills) {
        expect(allowed.has(skill)).toBe(true);
      }
    }
  });

  it('every suggestion has a welcome_summary and first_action', () => {
    for (const persona of ALL_PERSONAS) {
      const s = PERSONA_SUGGESTIONS[persona];
      expect(s.welcome_summary.length).toBeGreaterThan(10);
      expect(s.first_action).toBeTruthy();
    }
  });

  it('getSuggestionsForPersona returns the mapped suggestion', () => {
    expect(getSuggestionsForPersona('solo_dev')).toBe(PERSONA_SUGGESTIONS.solo_dev);
  });

  it('getSuggestionsForPersona falls back to unknown for invalid input', () => {
    // Cast to bypass TS — we want runtime fallback safety on stale DB data.
    const result = getSuggestionsForPersona('not_a_persona' as unknown as 'unknown');
    expect(result).toBe(PERSONA_SUGGESTIONS.unknown);
  });
});
