import { describe, it, expect } from 'vitest';
import { HIPAA_CONTROLS } from './compliance-hipaa.js';

describe('HIPAA Controls', () => {
  it('exports 15 controls', () => {
    expect(HIPAA_CONTROLS).toHaveLength(15);
  });

  it('all controls have required fields', () => {
    for (const control of HIPAA_CONTROLS) {
      expect(control.id).toBeTruthy();
      expect(control.name).toBeTruthy();
      expect(control.category).toBeTruthy();
      expect(control.framework).toBe('hipaa');
    }
  });

  it('control IDs are unique', () => {
    const ids = HIPAA_CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control IDs follow hipaa- prefix', () => {
    for (const control of HIPAA_CONTROLS) {
      expect(control.id).toMatch(/^hipaa-/);
    }
  });

  it('covers all safeguard categories', () => {
    const categories = new Set(HIPAA_CONTROLS.map((c) => c.category));
    expect(categories.has('Administrative Safeguards')).toBe(true);
    expect(categories.has('Physical Safeguards')).toBe(true);
    expect(categories.has('Technical Safeguards')).toBe(true);
  });
});
