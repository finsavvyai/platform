import { describe, it, expect } from 'vitest';
import { NIST_CSF_CONTROLS } from './compliance-nist.js';

describe('NIST CSF Controls', () => {
  it('exports 15 controls', () => {
    expect(NIST_CSF_CONTROLS).toHaveLength(15);
  });

  it('all controls have required fields', () => {
    for (const control of NIST_CSF_CONTROLS) {
      expect(control.id).toBeTruthy();
      expect(control.name).toBeTruthy();
      expect(control.category).toBeTruthy();
      expect(control.framework).toBe('nist_csf');
    }
  });

  it('control IDs are unique', () => {
    const ids = NIST_CSF_CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control IDs follow nist- prefix', () => {
    for (const control of NIST_CSF_CONTROLS) {
      expect(control.id).toMatch(/^nist-/);
    }
  });

  it('covers all 5 NIST functions', () => {
    const categories = new Set(NIST_CSF_CONTROLS.map((c) => c.category));
    expect(categories.has('Identify')).toBe(true);
    expect(categories.has('Protect')).toBe(true);
    expect(categories.has('Detect')).toBe(true);
    expect(categories.has('Respond')).toBe(true);
    expect(categories.has('Recover')).toBe(true);
  });
});
