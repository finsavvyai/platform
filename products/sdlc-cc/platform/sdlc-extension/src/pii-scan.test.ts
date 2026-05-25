/**
 * Pure-function tests for the PII scanner. Runnable via the node test runner
 * with `tsx --test src/pii-scan.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scan, redact, type Match } from './pii-scan';

const entities = (matches: Match[]): string[] => matches.map((m) => m.entity);

test('detects email', () => {
  const m = scan('email me at alice@example.com please');
  assert.deepEqual(entities(m), ['EMAIL']);
});

test('detects SSN with and without dashes', () => {
  assert.deepEqual(entities(scan('ssn 123-45-6789')), ['SSN']);
  assert.deepEqual(entities(scan('ssn 123456789')), ['SSN']);
});

test('rejects all-zero / 666 / 9xx SSN area numbers', () => {
  assert.equal(scan('000-12-3456').length, 0);
  assert.equal(scan('666-12-3456').length, 0);
  assert.equal(scan('900-12-3456').length, 0);
});

test('detects luhn-valid credit card and skips invalid', () => {
  // 4111 1111 1111 1111 is the canonical Visa test number.
  assert.deepEqual(entities(scan('card 4111 1111 1111 1111')), ['CREDIT_CARD']);
  assert.equal(scan('card 4111 1111 1111 1112').length, 0);
});

test('detects US phone in several formats', () => {
  assert.equal(scan('(415) 555-2671').length, 1);
  assert.equal(scan('+1 415.555.2671').length, 1);
  assert.equal(scan('4155552671').length, 1);
});

test('detects AWS access keys', () => {
  assert.deepEqual(entities(scan('AKIAIOSFODNN7EXAMPLE')), ['AWS_ACCESS_KEY']);
  assert.deepEqual(entities(scan('ASIAIOSFODNN7EXAMPLE')), ['AWS_ACCESS_KEY']);
});

test('detects generic API keys (sk-, ghp_, xoxb-)', () => {
  assert.deepEqual(entities(scan('OPENAI_KEY=sk-abcdef0123456789ABCDEF')), ['API_KEY_GENERIC']);
  assert.deepEqual(entities(scan('GH=ghp_abcdef0123456789ABCDEF1')), ['API_KEY_GENERIC']);
  assert.deepEqual(entities(scan('SLACK=xoxb-1234567890-abcdef')), ['API_KEY_GENERIC']);
});

test('detects IPv4 and rejects out-of-range octets', () => {
  assert.deepEqual(entities(scan('hit 10.0.0.1 and 192.168.1.5')), ['IPV4', 'IPV4']);
  assert.equal(scan('999.0.0.1').length, 0);
});

test('detects JWT triplet', () => {
  assert.deepEqual(
    entities(scan('token eyJabc123.eyJxyz456.signature_part_with_underscores-and-dashes')),
    ['JWT']
  );
});

test('redact swaps each match with a typed marker', () => {
  const out = redact('email alice@example.com and SSN 123-45-6789');
  assert.equal(out, 'email [REDACTED:EMAIL] and SSN [REDACTED:SSN]');
});

test('redact preserves untouched text when no match', () => {
  const out = redact('this message is clean');
  assert.equal(out, 'this message is clean');
});

test('overlapping matches keep the leftmost one', () => {
  // An IPv4 substring inside something longer shouldn't double-match.
  const out = scan('look at 10.0.0.1.5');
  assert.equal(out.length, 1);
  assert.equal(out[0].entity, 'IPV4');
});
