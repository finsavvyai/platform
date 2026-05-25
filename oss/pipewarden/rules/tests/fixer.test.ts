import { describe, it, expect, beforeEach } from 'vitest';
import { AutoFixer } from '../src/services/fixer';

describe('AutoFixer', () => {
  let fixer: AutoFixer;

  beforeEach(() => {
    fixer = new AutoFixer();
  });

  it('should have default fixes', () => {
    const fixes = fixer.listFixes();
    expect(fixes.length).toBeGreaterThan(0);
  });

  it('should get fix by id', () => {
    const fixes = fixer.listFixes();
    const first = fixes[0];

    const retrieved = fixer.getFix(first.id);

    expect(retrieved?.id).toBe(first.id);
  });

  it('should get fixes by type', () => {
    const xssFixes = fixer.getFixesByType('xss');
    expect(xssFixes.length).toBeGreaterThan(0);
  });

  it('should suggest XSS fix', () => {
    const code = 'element.innerHTML = userInput;';
    const fix = fixer.suggestFix(code, 'xss');

    expect(fix).toBeDefined();
    expect(fix?.type).toBe('xss');
  });

  it('should suggest SQL injection fix', () => {
    const code = "query('SELECT * FROM users WHERE id = ' + id + '');";
    const fix = fixer.suggestFix(code, 'sql-injection');

    expect(fix).toBeDefined();
  });

  it('should apply fix to code', () => {
    const fixes = fixer.listFixes();
    const xssFix = fixes.find((f) => f.type === 'xss');

    if (!xssFix) return;

    const fixed = fixer.applyFix('element.innerHTML = userInput;', xssFix.id);

    expect(fixed).not.toContain('innerHTML');
    expect(fixed).toContain('textContent');
  });

  it('should suggest and apply multiple fixes', () => {
    const code = 'innerHTML = x; query(\'select\' + x);';

    const result = fixer.suggestAndApplyFixes(code, [
      'xss',
      'sql-injection',
    ]);

    expect(result.code).not.toBe(code);
    expect(result.appliedFixes.length).toBeGreaterThan(0);
  });

  it('should handle code without vulnerabilities', () => {
    const code = 'const x = 1;';
    const result = fixer.suggestAndApplyFixes(code, ['xss', 'sql-injection']);

    expect(result.appliedFixes).toHaveLength(0);
  });

  it('should provide fix explanations', () => {
    const fixes = fixer.listFixes();

    fixes.forEach((fix) => {
      expect(fix.explanation.length).toBeGreaterThan(0);
    });
  });

  it('should calculate fix score', () => {
    const code = 'innerHTML = x;';
    const score = fixer.getFixScore(code);

    expect(score.original).toBeGreaterThanOrEqual(0);
    expect(score.fixed).toBeGreaterThanOrEqual(0);
    expect(score.improvement).toBeGreaterThanOrEqual(0);
  });

  it('should apply fixes for all types', () => {
    const code = 'innerHTML = x;';

    const result = fixer.suggestAndApplyFixes(code, [
      'xss',
      'sql-injection',
      'command-injection',
      'hardcoded-secret',
    ]);

    expect(result.code).toBeDefined();
  });
});
