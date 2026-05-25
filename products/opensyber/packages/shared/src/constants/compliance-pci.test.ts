import { describe, it, expect } from 'vitest';
import { PCI_DSS_CONTROLS } from './compliance-pci.js';

describe('PCI-DSS Controls', () => {
  it('exports 12 controls', () => {
    expect(PCI_DSS_CONTROLS).toHaveLength(12);
  });

  it('all controls have required fields', () => {
    for (const control of PCI_DSS_CONTROLS) {
      expect(control.id).toBeTruthy();
      expect(control.name).toBeTruthy();
      expect(control.category).toBeTruthy();
      expect(control.framework).toBe('pci_dss');
    }
  });

  it('control IDs are unique', () => {
    const ids = PCI_DSS_CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control IDs follow pci- prefix', () => {
    for (const control of PCI_DSS_CONTROLS) {
      expect(control.id).toMatch(/^pci-/);
    }
  });

  it('covers all 12 PCI requirements', () => {
    expect(PCI_DSS_CONTROLS.length).toBe(12);
    const ids = PCI_DSS_CONTROLS.map((c) => c.id);
    for (let i = 1; i <= 12; i++) {
      expect(ids).toContain(`pci-${i}`);
    }
  });
});
