import { describe, it, expect } from 'vitest';
import { GDPR_CONTROLS } from './compliance-gdpr.js';

describe('GDPR Controls', () => {
  it('exports 12 controls', () => {
    expect(GDPR_CONTROLS).toHaveLength(12);
  });

  it('all controls have required fields', () => {
    for (const control of GDPR_CONTROLS) {
      expect(control.id).toBeTruthy();
      expect(control.name).toBeTruthy();
      expect(control.category).toBeTruthy();
      expect(control.framework).toBe('gdpr');
    }
  });

  it('control IDs are unique', () => {
    const ids = GDPR_CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control IDs follow gdpr- prefix', () => {
    for (const control of GDPR_CONTROLS) {
      expect(control.id).toMatch(/^gdpr-/);
    }
  });

  it('covers Security category', () => {
    const securityControls = GDPR_CONTROLS.filter((c) => c.category === 'Security');
    expect(securityControls.length).toBeGreaterThan(0);
  });
});
