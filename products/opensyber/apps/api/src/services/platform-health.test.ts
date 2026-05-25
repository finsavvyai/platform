/**
 * Platform Health Tests
 */
import { describe, it, expect } from 'vitest';
import { aggregatePlatformHealth, getDefaultSubsystems } from './platform-health.js';

describe('Platform Health', () => {
  it('reports healthy when all subsystems healthy', () => {
    const subsystems = getDefaultSubsystems();
    const health = aggregatePlatformHealth(subsystems);
    expect(health.overall).toBe('healthy');
    expect(health.uptimePercent).toBe(100);
  });

  it('reports degraded when one subsystem degraded', () => {
    const subsystems = [
      { name: 'API', status: 'healthy' as const },
      { name: 'DB', status: 'degraded' as const, details: 'Slow queries' },
    ];
    const health = aggregatePlatformHealth(subsystems);
    expect(health.overall).toBe('degraded');
    expect(health.uptimePercent).toBe(50);
  });

  it('reports down when one subsystem down', () => {
    const subsystems = [
      { name: 'API', status: 'healthy' as const },
      { name: 'Auth', status: 'down' as const },
    ];
    const health = aggregatePlatformHealth(subsystems);
    expect(health.overall).toBe('down');
  });

  it('handles empty subsystems', () => {
    const health = aggregatePlatformHealth([]);
    expect(health.overall).toBe('healthy');
    expect(health.uptimePercent).toBe(100);
  });

  it('returns default subsystems', () => {
    const subsystems = getDefaultSubsystems();
    expect(subsystems.length).toBeGreaterThanOrEqual(6);
    expect(subsystems.every((s) => s.status === 'healthy')).toBe(true);
  });
});
