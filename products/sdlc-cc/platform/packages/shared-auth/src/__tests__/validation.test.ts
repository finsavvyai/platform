import { describe, it, expect } from '@jest/globals';
import {
  validateEmail,
  validatePassword,
  validateName,
  validateTier,
  validateMFA,
  validateRegistration,
  validationMessages,
} from '../validation';

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe('validateEmail', () => {
  it('returns null for a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('returns null for emails with subdomains and plus addressing', () => {
    expect(validateEmail('user+tag@mail.example.co')).toBeNull();
  });

  it('returns emailRequired for empty string', () => {
    expect(validateEmail('')).toBe(validationMessages.emailRequired);
  });

  it('returns emailInvalid for missing @ symbol', () => {
    expect(validateEmail('userexample.com')).toBe(validationMessages.emailInvalid);
  });

  it('returns emailInvalid for missing domain', () => {
    expect(validateEmail('user@')).toBe(validationMessages.emailInvalid);
  });

  it('returns emailInvalid for email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(validationMessages.emailInvalid);
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------
describe('validatePassword', () => {
  const valid = 'Str0ng!Pass';

  it('returns null for a strong password', () => {
    expect(validatePassword(valid)).toBeNull();
  });

  it('returns passwordRequired for empty string', () => {
    expect(validatePassword('')).toBe(validationMessages.passwordRequired);
  });

  it('returns error when password is shorter than 8 characters', () => {
    const result = validatePassword('Ab1!');
    expect(result).toContain(validationMessages.passwordMinLength);
  });

  it('returns error when no uppercase letter present', () => {
    const result = validatePassword('str0ng!pass');
    expect(result).toContain(validationMessages.passwordUppercase);
  });

  it('returns error when no lowercase letter present', () => {
    const result = validatePassword('STR0NG!PASS');
    expect(result).toContain(validationMessages.passwordLowercase);
  });

  it('returns error when no number present', () => {
    const result = validatePassword('Strong!Pass');
    expect(result).toContain(validationMessages.passwordNumber);
  });

  it('returns error when no special character present', () => {
    const result = validatePassword('Str0ngPass');
    expect(result).toContain(validationMessages.passwordSpecial);
  });

  it('concatenates multiple errors with a comma', () => {
    // Only uppercase, no digit, no special, too short
    const result = validatePassword('ab');
    expect(result).toContain(',');
  });
});

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------
describe('validateName', () => {
  it('returns null for a valid name', () => {
    expect(validateName('Alice')).toBeNull();
  });

  it('returns nameRequired for empty string', () => {
    expect(validateName('')).toBe(validationMessages.nameRequired);
  });

  it('returns nameRequired for whitespace-only string', () => {
    expect(validateName('   ')).toBe(validationMessages.nameRequired);
  });

  it('returns nameMinLength for single-character name', () => {
    expect(validateName('A')).toBe(validationMessages.nameMinLength);
  });
});

// ---------------------------------------------------------------------------
// validateTier
// ---------------------------------------------------------------------------
describe('validateTier', () => {
  it.each(['starter', 'professional', 'enterprise'])('returns null for valid tier %s', (tier) => {
    expect(validateTier(tier)).toBeNull();
  });

  it('returns tierRequired for empty string', () => {
    expect(validateTier('')).toBe(validationMessages.tierRequired);
  });

  it('returns invalid message for an unknown tier', () => {
    expect(validateTier('freemium')).toBe('Invalid subscription tier');
  });
});

// ---------------------------------------------------------------------------
// validateMFA
// ---------------------------------------------------------------------------
describe('validateMFA', () => {
  it('returns null for a valid 6-digit token', () => {
    expect(validateMFA('123456')).toBeNull();
  });

  it('returns mfaTokenRequired for empty string', () => {
    expect(validateMFA('')).toBe(validationMessages.mfaTokenRequired);
  });

  it('returns mfaTokenLength for non-numeric token', () => {
    expect(validateMFA('abc123')).toBe(validationMessages.mfaTokenLength);
  });

  it('returns mfaTokenLength for fewer than 6 digits', () => {
    expect(validateMFA('12345')).toBe(validationMessages.mfaTokenLength);
  });

  it('returns mfaTokenLength for more than 6 digits', () => {
    expect(validateMFA('1234567')).toBe(validationMessages.mfaTokenLength);
  });
});

// validateMFABackupCode is tested in validation-forms.test.ts

// ---------------------------------------------------------------------------
// validateRegistration
// ---------------------------------------------------------------------------
describe('validateRegistration', () => {
  const valid = { email: 'a@b.com', password: 'Str0ng!Pass', name: 'Alice' };

  it('returns empty array when all fields are valid', () => {
    expect(validateRegistration(valid.email, valid.password, valid.name)).toEqual([]);
  });

  it('includes email error for invalid email', () => {
    const errors = validateRegistration('bad-email', valid.password, valid.name);
    expect(errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('includes password error for weak password', () => {
    const errors = validateRegistration(valid.email, 'weak', valid.name);
    expect(errors.some((e) => e.field === 'password')).toBe(true);
  });

  it('includes name error for empty name', () => {
    const errors = validateRegistration(valid.email, valid.password, '');
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('validates optional tier when provided', () => {
    const errors = validateRegistration(valid.email, valid.password, valid.name, 'invalid-tier');
    expect(errors.some((e) => e.field === 'tier')).toBe(true);
  });

  it('does not validate tier when not provided', () => {
    const errors = validateRegistration(valid.email, valid.password, valid.name, undefined);
    expect(errors.some((e) => e.field === 'tier')).toBe(false);
  });
});

// validateLogin, validateOrganizationName, validateOrganizationSlug, validateAPIKey,
// and utility helpers are tested in validation-forms.test.ts / validation-utils.test.ts
