import { describe, it, expect } from 'vitest';
import {
  DLP_RULES,
  evaluateDlp,
  ibanValid,
  ilIdValid,
  luhnValid,
  renderE2guardianRegexBody,
} from './dlp-rules.js';

describe('luhnValid', () => {
  it('accepts known-good PANs', () => {
    expect(luhnValid('4111111111111111')).toBe(true); // Visa test
    expect(luhnValid('5555555555554444')).toBe(true); // MC test
    expect(luhnValid('378282246310005')).toBe(true);  // Amex test (15 digits)
  });
  it('rejects fake PANs and short strings', () => {
    expect(luhnValid('4111111111111112')).toBe(false);
    expect(luhnValid('1234')).toBe(false);
    expect(luhnValid('00000000000000000000')).toBe(false);
  });
  it('strips spaces and dashes', () => {
    expect(luhnValid('4111-1111-1111-1111')).toBe(true);
    expect(luhnValid('4111 1111 1111 1111')).toBe(true);
  });
});

describe('ilIdValid', () => {
  it('accepts known-good Israeli IDs', () => {
    expect(ilIdValid('000000018')).toBe(true);
    expect(ilIdValid('123456782')).toBe(true);
  });
  it('rejects bad check digits and wrong lengths', () => {
    expect(ilIdValid('123456789')).toBe(false);
    expect(ilIdValid('12345')).toBe(false);
    expect(ilIdValid('abcdefghi')).toBe(false);
  });
});

describe('ibanValid', () => {
  it('accepts canonical IBAN test vectors', () => {
    expect(ibanValid('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(ibanValid('DE89370400440532013000')).toBe(true);
    expect(ibanValid('IL620108000000099999999')).toBe(true);
  });
  it('rejects bad checksums and malformed strings', () => {
    expect(ibanValid('GB82WEST12345698765433')).toBe(false);
    expect(ibanValid('XX00')).toBe(false);
    expect(ibanValid('not an iban at all')).toBe(false);
  });
});

describe('evaluateDlp', () => {
  it('flags PCI PAN with Luhn validation', () => {
    const matches = evaluateDlp('card on file 4111-1111-1111-1111 thanks');
    expect(matches.find((m) => m.ruleId === 'pci_pan')).toBeDefined();
    expect(matches.find((m) => m.ruleId === 'pci_pan')?.severity).toBe('critical');
  });

  it('does NOT flag fake PANs that fail Luhn', () => {
    const matches = evaluateDlp('the number 1234567890123456 is just digits');
    expect(matches.find((m) => m.ruleId === 'pci_pan')).toBeUndefined();
  });

  it('flags IL ID inside arbitrary text', () => {
    const matches = evaluateDlp('teudat zehut 123456782 here');
    expect(matches.find((m) => m.ruleId === 'il_id')?.severity).toBe('high');
  });

  it('flags valid IBAN and ignores invalid checksum', () => {
    const ok = evaluateDlp('iban GB82WEST12345698765432');
    const bad = evaluateDlp('iban GB99WEST12345698765432');
    expect(ok.find((m) => m.ruleId === 'iban')).toBeDefined();
    expect(bad.find((m) => m.ruleId === 'iban')).toBeUndefined();
  });

  it('redacts payload previews', () => {
    const matches = evaluateDlp('card 4111111111111111');
    const m = matches.find((x) => x.ruleId === 'pci_pan');
    expect(m?.preview).toMatch(/^4111\*+1111$/);
  });

  it('flags multiple matches in one body', () => {
    const text = 'PAN 4111111111111111 and email user@example.com';
    const matches = evaluateDlp(text);
    expect(matches.map((m) => m.ruleId).sort()).toContain('pci_pan');
    expect(matches.map((m) => m.ruleId).sort()).toContain('email');
  });

  it('respects custom rule subset', () => {
    const onlyEmail = DLP_RULES.filter((r) => r.id === 'email');
    const matches = evaluateDlp('PAN 4111111111111111 user@example.com', onlyEmail);
    expect(matches.every((m) => m.ruleId === 'email')).toBe(true);
  });

  it('Sprint 35 line 51: email rule does NOT match strings without email shape (negative-direction pin)', () => {
    // The 4 DLP patterns (PAN/IL ID/IBAN/email) each need positive AND
    // negative coverage. PAN/IL ID/IBAN already pin the negative direction;
    // email previously only had positive cases. Lock that "no @ → no match"
    // so a future regex tweak can't accidentally start matching bare names.
    const matches = evaluateDlp('this string has no email shape at all');
    expect(matches.find((m) => m.ruleId === 'email')).toBeUndefined();
  });
});

describe('renderE2guardianRegexBody', () => {
  it('emits one regex line per rule plus comments', () => {
    const body = renderE2guardianRegexBody();
    for (const r of DLP_RULES) {
      expect(body).toContain(r.regex.source);
      expect(body).toContain(`# ${r.id}: ${r.description}`);
    }
  });
});
