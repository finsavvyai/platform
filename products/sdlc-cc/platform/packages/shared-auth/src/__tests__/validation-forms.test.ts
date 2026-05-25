/**
 * Tests for organization and API key validators in validation.ts.
 */
import { describe, it, expect } from '@jest/globals';
import {
  validateOrganizationName,
  validateOrganizationSlug,
  validateAPIKey,
  validateLogin,
  validateMFABackupCode,
} from '../validation';

// ---------------------------------------------------------------------------
// validateMFABackupCode
// ---------------------------------------------------------------------------
describe('validateMFABackupCode', () => {
  it('returns null for a valid 8-char uppercase alphanumeric code', () => {
    expect(validateMFABackupCode('ABCD1234')).toBeNull();
  });

  it('returns error for empty code', () => {
    expect(validateMFABackupCode('')).toBe('Backup code is required');
  });

  it('returns error for lowercase code', () => {
    expect(validateMFABackupCode('abcd1234')).toBe('Backup code must be 8 characters');
  });

  it('returns error for code shorter than 8 characters', () => {
    expect(validateMFABackupCode('ABC123')).toBe('Backup code must be 8 characters');
  });
});

// ---------------------------------------------------------------------------
// validateLogin
// ---------------------------------------------------------------------------
describe('validateLogin', () => {
  it('returns empty array for valid credentials', () => {
    expect(validateLogin('user@example.com', 'anypassword')).toEqual([]);
  });

  it('returns email error for invalid email', () => {
    const errors = validateLogin('notanemail', 'pass');
    expect(errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('returns password error for empty password', () => {
    const errors = validateLogin('user@example.com', '');
    expect(errors.some((e) => e.field === 'password')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateOrganizationName
// ---------------------------------------------------------------------------
describe('validateOrganizationName', () => {
  it('returns null for a valid organization name', () => {
    expect(validateOrganizationName('Acme Corp')).toBeNull();
  });

  it('allows alphanumeric with dots and underscores', () => {
    expect(validateOrganizationName('ACME_Corp.Ltd')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateOrganizationName('')).toBe('Organization name is required');
  });

  it('returns error for whitespace-only input', () => {
    expect(validateOrganizationName('   ')).toBe('Organization name is required');
  });

  it('returns error for single character name', () => {
    expect(validateOrganizationName('A')).toBe('Organization name must be at least 2 characters long');
  });

  it('returns error for name exceeding 100 characters', () => {
    expect(validateOrganizationName('A'.repeat(101))).toBe('Organization name must be less than 100 characters');
  });

  it('returns error when name contains < or > characters', () => {
    expect(validateOrganizationName('Acme<Corp>')).toBe('Organization name contains invalid characters');
  });

  it('returns error for name with @ symbol', () => {
    expect(validateOrganizationName('Acme@Corp')).toBe('Organization name contains invalid characters');
  });

  it('accepts name at the 100-character boundary', () => {
    expect(validateOrganizationName('A'.repeat(100))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateOrganizationSlug
// ---------------------------------------------------------------------------
describe('validateOrganizationSlug', () => {
  it('returns null for a valid lowercase slug', () => {
    expect(validateOrganizationSlug('acme-corp')).toBeNull();
  });

  it('returns null for slug with underscores and digits', () => {
    expect(validateOrganizationSlug('acme_corp_2')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateOrganizationSlug('')).toBe('Organization slug is required');
  });

  it('returns error for whitespace-only input', () => {
    expect(validateOrganizationSlug('   ')).toBe('Organization slug is required');
  });

  it('returns error for slug shorter than 2 characters', () => {
    expect(validateOrganizationSlug('a')).toBe('Organization slug must be at least 2 characters long');
  });

  it('returns error for slug with uppercase letters', () => {
    expect(validateOrganizationSlug('AcmeCorp')).toContain('lowercase');
  });

  it('returns error for slug exceeding 50 characters', () => {
    expect(validateOrganizationSlug('a'.repeat(51))).toBe('Organization slug must be less than 50 characters');
  });

  it('accepts slug at the 50-character boundary', () => {
    expect(validateOrganizationSlug('a'.repeat(50))).toBeNull();
  });

  it('returns error for slug with spaces', () => {
    expect(validateOrganizationSlug('acme corp')).toContain('lowercase');
  });
});

// ---------------------------------------------------------------------------
// validateAPIKey
// ---------------------------------------------------------------------------
describe('validateAPIKey', () => {
  it('returns null for a valid API key name', () => {
    expect(validateAPIKey('Production Key')).toBeNull();
  });

  it('returns null for a single character name', () => {
    expect(validateAPIKey('k')).toBeNull();
  });

  it('returns error for empty name', () => {
    expect(validateAPIKey('')).toBe('API key name is required');
  });

  it('returns error for whitespace-only name', () => {
    expect(validateAPIKey('   ')).toBe('API key name is required');
  });

  it('returns error for name exceeding 100 characters', () => {
    expect(validateAPIKey('k'.repeat(101))).toBe('API key name must be less than 100 characters');
  });

  it('accepts name at the 100-character boundary', () => {
    expect(validateAPIKey('k'.repeat(100))).toBeNull();
  });
});
