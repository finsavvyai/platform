import { describe, it, expect } from 'vitest';
import { isValidDomain } from './public-scan';

describe('isValidDomain', () => {
	it('accepts standard domains', () => {
		expect(isValidDomain('acme.com')).toBe(true);
		expect(isValidDomain('mail.acme.co.il')).toBe(true);
		expect(isValidDomain('a-b.example.org')).toBe(true);
	});
	it('rejects garbage', () => {
		expect(isValidDomain('')).toBe(false);
		expect(isValidDomain('not a domain')).toBe(false);
		expect(isValidDomain('http://acme.com')).toBe(false);
		expect(isValidDomain('acme')).toBe(false);
		expect(isValidDomain('-acme.com')).toBe(false);
		expect(isValidDomain('acme-.com')).toBe(false);
	});
	it('rejects domains over 253 characters', () => {
		expect(isValidDomain(`${'a'.repeat(254)}.com`)).toBe(false);
	});
	it('lowercases and trims', () => {
		expect(isValidDomain('  ACME.COM  ')).toBe(true);
	});
});
