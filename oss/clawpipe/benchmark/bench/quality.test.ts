/** quality.test.ts — unit tests for normalize + byteEqual + isRegression. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
// Note: this repo uses node:test, not vitest, to keep the dep tree minimal.
import { normalize, byteEqual, isRegression } from './quality';

test('normalize: collapses whitespace and lowercases plain text', () => {
  assert.strictEqual(normalize('Hello   World\n\n'), 'hello world');
});

test('normalize: sorts JSON keys', () => {
  const a = normalize('{"b":2,"a":1,"c":{"e":5,"d":4}}');
  const b = normalize('{"a":1,"c":{"d":4,"e":5},"b":2}');
  assert.strictEqual(a, b);
});

test('normalize: leaves non-JSON unchanged beyond whitespace', () => {
  assert.strictEqual(normalize('  Result: 42  '), 'result: 42');
});

test('byteEqual: matches across whitespace and case', () => {
  assert.strictEqual(byteEqual('  Yes  ', 'YES'), true);
});

test('byteEqual: distinguishes different content', () => {
  assert.strictEqual(byteEqual('A', 'B'), false);
});

test('byteEqual: matches JSON regardless of key order', () => {
  assert.strictEqual(byteEqual('{"x":1,"y":2}', '{"y":2,"x":1}'), true);
});

test('isRegression: needs >=2 disagreeing judges', () => {
  const v = (agree: boolean, judge: string) => ({ judge, agree, reason: '' });
  assert.strictEqual(isRegression([v(true, 'a'), v(true, 'b'), v(true, 'c')]), false);
  assert.strictEqual(isRegression([v(false, 'a'), v(true, 'b'), v(true, 'c')]), false);
  assert.strictEqual(isRegression([v(false, 'a'), v(false, 'b'), v(true, 'c')]), true);
  assert.strictEqual(isRegression([v(false, 'a'), v(false, 'b'), v(false, 'c')]), true);
});

test('isRegression: errored judges do NOT count as disagree', () => {
  const v = (agree: boolean, judge: string, error?: string) => ({ judge, agree, reason: '', error });
  // 1 disagree + 1 errored + 1 agree = NOT regression (only 1 actual disagree)
  assert.strictEqual(isRegression([v(false, 'a'), v(false, 'b', 'timeout'), v(true, 'c')]), false);
});
