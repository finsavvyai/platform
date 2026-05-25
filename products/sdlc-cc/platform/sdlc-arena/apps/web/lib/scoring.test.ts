import { test } from 'node:test';
import assert from 'node:assert/strict';

import { judge, type Challenge } from './scoring';
import type { GuardResult } from './guard';

const ch: Challenge = {
  id: 'x',
  title: 't',
  category: 'c',
  difficulty: 1,
  system_prompt: 's',
  objective: 'o',
  guard_threshold: 0.8,
  points: 100,
};

const guard = (score: number): GuardResult => ({
  score,
  label: score >= 0.5 ? 'attack' : 'benign',
  signals: [],
  source: 'heuristic',
});

test('detected attack scores zero', () => {
  const v = judge(guard(0.9), ch, true);
  assert.equal(v.detected, true);
  assert.equal(v.bypassed, false);
  assert.equal(v.pointsEarned, 0);
});

test('guard let through but objective not met → zero points, not a bypass', () => {
  const v = judge(guard(0.2), ch, false);
  assert.equal(v.detected, false);
  assert.equal(v.bypassed, false);
  assert.equal(v.pointsEarned, 0);
});

test('bypass earns full points', () => {
  const v = judge(guard(0.2), ch, true);
  assert.equal(v.bypassed, true);
  assert.equal(v.pointsEarned, ch.points);
});

test('exactly-at-threshold counts as detected', () => {
  const v = judge(guard(0.8), ch, true);
  assert.equal(v.detected, true);
  assert.equal(v.pointsEarned, 0);
});
