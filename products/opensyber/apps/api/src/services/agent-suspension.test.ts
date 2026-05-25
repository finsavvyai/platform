/**
 * Agent Suspension Service Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { validateSuspensionAction } from './agent-suspension.js';

vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Agent Suspension', () => {
  it('validates duplicate suspend', () => {
    const v = validateSuspensionAction('suspended', 'suspend');
    expect(v.valid).toBe(false);
    expect(v.error).toContain('already suspended');
  });

  it('validates duplicate resume for running state', () => {
    const v = validateSuspensionAction('running', 'resume');
    expect(v.valid).toBe(false);
    expect(v.error).toContain('already running');
  });

  it('validates duplicate quarantine', () => {
    const v = validateSuspensionAction('quarantined', 'quarantine');
    expect(v.valid).toBe(false);
    expect(v.error).toContain('already quarantined');
  });

  it('allows valid transitions', () => {
    expect(validateSuspensionAction('running', 'suspend').valid).toBe(true);
    expect(validateSuspensionAction('suspended', 'resume').valid).toBe(true);
    expect(validateSuspensionAction('running', 'quarantine').valid).toBe(true);
  });

  it('allows suspend from running state', () => {
    const v = validateSuspensionAction('running', 'suspend');
    expect(v.valid).toBe(true);
    expect(v.error).toBeUndefined();
  });
});
