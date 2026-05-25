// Auto-fix suggestions: for common vulnerability patterns
export interface FixSuggestion {
  id: string;
  vulnerable: string;
  fixed: string;
  explanation: string;
  type: 'xss' | 'sql-injection' | 'command-injection' | 'hardcoded-secret';
}

export class AutoFixer {
  private fixes: Map<string, FixSuggestion> = new Map();

  constructor() {
    this.initializeDefaultFixes();
  }

  private initializeDefaultFixes(): void {
    // XSS fixes
    this.addFix('xss', 'element.innerHTML = userInput;', 'element.textContent = userInput;', 'Use textContent instead of innerHTML to prevent XSS');

    // SQL Injection fixes
    this.addFix(
      'sql-injection',
      "query('SELECT * FROM users WHERE id = ' + id + '');",
      "query('SELECT * FROM users WHERE id = ?', [id]);",
      'Use parameterized queries'
    );

    // Command Injection fixes
    this.addFix(
      'command-injection',
      "exec('rm -rf ' + userPath);",
      "execFile('rm', ['-rf', userPath]);",
      'Use execFile with separate arguments'
    );

    // Hardcoded Secrets fixes
    this.addFix(
      'hardcoded-secret',
      'const password = "secret123";',
      'const password = process.env.DB_PASSWORD;',
      'Move secrets to environment variables'
    );
  }

  private addFix(
    type: FixSuggestion['type'],
    vulnerable: string,
    fixed: string,
    explanation: string
  ): void {
    const fix: FixSuggestion = {
      id: `fix_${Date.now()}_${this.fixes.size}`,
      vulnerable,
      fixed,
      explanation,
      type,
    };

    this.fixes.set(fix.id, fix);
  }

  getFix(id: string): FixSuggestion | undefined {
    return this.fixes.get(id);
  }

  listFixes(): FixSuggestion[] {
    return Array.from(this.fixes.values());
  }

  getFixesByType(type: FixSuggestion['type']): FixSuggestion[] {
    return Array.from(this.fixes.values()).filter((f) => f.type === type);
  }

  suggestFix(code: string, type: FixSuggestion['type']): FixSuggestion | null {
    const fixes = this.getFixesByType(type);

    for (const fix of fixes) {
      if (code.includes(fix.vulnerable)) {
        return fix;
      }
    }

    return null;
  }

  applyFix(code: string, fixId: string): string | null {
    const fix = this.fixes.get(fixId);
    if (!fix) return null;

    return code.replace(new RegExp(fix.vulnerable, 'g'), fix.fixed);
  }

  suggestAndApplyFixes(code: string, vulnerabilityTypes: FixSuggestion['type'][]): { code: string; appliedFixes: FixSuggestion[] } {
    let updatedCode = code;
    const appliedFixes: FixSuggestion[] = [];

    for (const type of vulnerabilityTypes) {
      const fix = this.suggestFix(updatedCode, type);
      if (fix && updatedCode.includes(fix.vulnerable)) {
        updatedCode = updatedCode.replace(new RegExp(fix.vulnerable, 'g'), fix.fixed);
        appliedFixes.push(fix);
      }
    }

    return { code: updatedCode, appliedFixes };
  }

  getFixScore(code: string): { original: number; fixed: number; improvement: number } {
    // Count vulnerabilities in original
    const allFixes = this.listFixes();
    let original = 0;

    allFixes.forEach((fix) => {
      const regex = new RegExp(fix.vulnerable, 'g');
      const matches = code.match(regex);
      if (matches) original += matches.length;
    });

    // Simulate fixed code
    const { code: fixedCode } = this.suggestAndApplyFixes(
      code,
      ['xss', 'sql-injection', 'command-injection', 'hardcoded-secret']
    );

    let fixed = 0;
    allFixes.forEach((fix) => {
      const regex = new RegExp(fix.vulnerable, 'g');
      const matches = fixedCode.match(regex);
      if (matches) fixed += matches.length;
    });

    return {
      original,
      fixed,
      improvement: original - fixed,
    };
  }
}
