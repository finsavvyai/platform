/**
 * Thompson Sampling tests — Beta distribution + bandit pick.
 */

import { describe, it, expect } from 'vitest';
import {
  sampleBeta,
  thompsonPick,
  decayWeight,
  shouldExplore,
  type BanditArm,
} from '../packages/api/src/services/thompson-sampling';

describe('sampleBeta', () => {
  it('returns value in [0, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const x = sampleBeta(5, 5);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it('Beta(10, 1) skews high', () => {
    let sum = 0;
    const n = 500;
    for (let i = 0; i < n; i++) {
      sum += sampleBeta(10, 1);
    }
    const mean = sum / n;
    // True mean of Beta(10,1) = 10/11 ≈ 0.91
    expect(mean).toBeGreaterThan(0.8);
  });

  it('Beta(1, 10) skews low', () => {
    let sum = 0;
    const n = 500;
    for (let i = 0; i < n; i++) {
      sum += sampleBeta(1, 10);
    }
    const mean = sum / n;
    // True mean of Beta(1,10) = 1/11 ≈ 0.09
    expect(mean).toBeLessThan(0.2);
  });

  it('Beta(1, 1) is uniform (mean ~0.5)', () => {
    let sum = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      sum += sampleBeta(1, 1);
    }
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });
});

describe('thompsonPick', () => {
  it('returns null for empty arms', () => {
    expect(thompsonPick([])).toBeNull();
  });

  it('returns single arm when only one', () => {
    const arm: BanditArm = { id: 'a', successes: 5, failures: 2 };
    expect(thompsonPick([arm])).toBe(arm);
  });

  it('prefers arm with higher success rate over many trials', () => {
    const winner: BanditArm = { id: 'winner', successes: 90, failures: 10 };
    const loser: BanditArm = { id: 'loser', successes: 10, failures: 90 };

    const picks = { winner: 0, loser: 0 };
    for (let i = 0; i < 200; i++) {
      const pick = thompsonPick([winner, loser]);
      if (pick?.id === 'winner') picks.winner++;
      else picks.loser++;
    }

    // Winner should be picked >> 80% of the time
    expect(picks.winner).toBeGreaterThan(150);
  });

  it('explores when arms have similar performance', () => {
    const arm1: BanditArm = { id: 'a', successes: 5, failures: 5 };
    const arm2: BanditArm = { id: 'b', successes: 5, failures: 5 };

    const picks = { a: 0, b: 0 };
    for (let i = 0; i < 100; i++) {
      const pick = thompsonPick([arm1, arm2]);
      if (pick?.id === 'a') picks.a++;
      else picks.b++;
    }

    // Roughly 50/50 (give wide tolerance for randomness)
    expect(picks.a).toBeGreaterThan(25);
    expect(picks.b).toBeGreaterThan(25);
  });
});

describe('decayWeight', () => {
  it('returns 1.0 for age=0', () => {
    expect(decayWeight(0)).toBeCloseTo(1.0, 5);
  });

  it('decays over time', () => {
    expect(decayWeight(30)).toBeLessThan(decayWeight(0));
    expect(decayWeight(60)).toBeLessThan(decayWeight(30));
  });

  it('30-day half-life approximates 0.37', () => {
    // e^(-1) ≈ 0.368
    expect(decayWeight(30)).toBeCloseTo(0.368, 2);
  });

  it('never reaches zero', () => {
    expect(decayWeight(10000)).toBeGreaterThan(0);
  });
});

describe('shouldExplore', () => {
  it('explores more when sample size is low', () => {
    let explorations = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldExplore(5)) explorations++;
    }
    // With sampleSize=5 and default rate 0.1, we do 2*rate = 0.2
    // So expect ~20% (wide tolerance)
    expect(explorations).toBeGreaterThan(100);
    expect(explorations).toBeLessThan(300);
  });

  it('explores ~10% when sample size is high', () => {
    let explorations = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldExplore(100)) explorations++;
    }
    expect(explorations).toBeGreaterThan(50);
    expect(explorations).toBeLessThan(150);
  });

  it('respects custom exploration rate', () => {
    let explorations = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldExplore(100, 0.5)) explorations++;
    }
    expect(explorations).toBeGreaterThan(400);
    expect(explorations).toBeLessThan(600);
  });
});
