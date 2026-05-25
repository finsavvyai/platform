import { describe, it, expect } from 'vitest';
import { computeGrade } from './assessment-runner.js';

describe('OASF Assessment Runner', () => {
  describe('computeGrade', () => {
    it('returns A+ for 100', () => expect(computeGrade(100)).toBe('A+'));
    it('returns A for 93-99', () => {
      expect(computeGrade(93)).toBe('A');
      expect(computeGrade(99)).toBe('A');
    });
    it('returns B for 80-92', () => {
      expect(computeGrade(80)).toBe('B');
      expect(computeGrade(92)).toBe('B');
    });
    it('returns C for 65-79', () => {
      expect(computeGrade(65)).toBe('C');
      expect(computeGrade(79)).toBe('C');
    });
    it('returns D for 50-64', () => {
      expect(computeGrade(50)).toBe('D');
      expect(computeGrade(64)).toBe('D');
    });
    it('returns F for below 50', () => {
      expect(computeGrade(49)).toBe('F');
      expect(computeGrade(0)).toBe('F');
    });
  });
});
