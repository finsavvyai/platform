import { describe, it, expect } from 'vitest';
import { mapDefenderSeverity } from './defender-o365.js';

describe('defender-o365: severity mapping', () => {
  describe('mapDefenderSeverity', () => {
    it('maps malware and dangerous verdicts to critical', () => {
      expect(mapDefenderSeverity('Malware')).toBe('critical');
      expect(mapDefenderSeverity('DangerousFile')).toBe('critical');
      expect(mapDefenderSeverity('MALWARE')).toBe('critical');
      expect(mapDefenderSeverity('malware')).toBe('critical');
    });

    it('maps phishing and suspicious verdicts to high', () => {
      expect(mapDefenderSeverity('Phishing')).toBe('high');
      expect(mapDefenderSeverity('Suspicious')).toBe('high');
      expect(mapDefenderSeverity('PHISHING')).toBe('high');
      expect(mapDefenderSeverity('phishing')).toBe('high');
    });

    it('maps warning verdict to medium', () => {
      expect(mapDefenderSeverity('Warning')).toBe('medium');
      expect(mapDefenderSeverity('WARNING')).toBe('medium');
      expect(mapDefenderSeverity('warning')).toBe('medium');
    });

    it('returns low for unknown verdict', () => {
      expect(mapDefenderSeverity('Unknown')).toBe('low');
      expect(mapDefenderSeverity('Clean')).toBe('low');
      expect(mapDefenderSeverity('')).toBe('low');
    });

    it('handles null and undefined gracefully', () => {
      expect(mapDefenderSeverity(null as any)).toBe('low');
      expect(mapDefenderSeverity(undefined as any)).toBe('low');
    });

    it('handles compound verdicts with multiple threat types', () => {
      expect(mapDefenderSeverity('Malware + Phishing')).toBe('critical');
      expect(mapDefenderSeverity('Suspicious Dangerous')).toBe('critical');
    });
  });
});
