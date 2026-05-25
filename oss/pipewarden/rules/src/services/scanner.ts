// Security scanner: scan code for vulnerabilities
export interface Vulnerability {
  id: string;
  type: 'xss' | 'sql-injection' | 'command-injection' | 'hardcoded-secret' | 'unsafe-eval';
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  column: number;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ScanResult {
  id: string;
  filename: string;
  language: string;
  vulnerabilities: Vulnerability[];
  scanTime: number;
  timestamp: Date;
}

export class SecurityScanner {
  private results: Map<string, ScanResult> = new Map();

  private patterns: Record<string, RegExp[]> = {
    xss: [
      /innerHTML\s*=\s*(?!['"`][\w-]*['"`])/gi,
      /dangerouslySetInnerHTML/gi,
      /\.html\(/gi,
    ],
    'sql-injection': [
      /query\s*\(\s*['"]\s*\+\s*/gi,
      /\.query\s*\(\s*`.*\$\{/gi,
      /concatenate.*sql/gi,
    ],
    'command-injection': [
      /exec\s*\([^,]*\+/gi,
      /spawn\s*\([^,]*\+/gi,
      /shell:\s*true/gi,
    ],
    'hardcoded-secret': [
      /password\s*[=:]\s*['"][^'"]*['"]/gi,
      /api[_-]?key\s*[=:]\s*['"][^'"]*['"]/gi,
      /secret\s*[=:]\s*['"][^'"]*['"]/gi,
    ],
    'unsafe-eval': [
      /eval\s*\(/gi,
      /Function\s*\(\s*['"].*['"]\s*\)/gi,
      /new Function\s*\(/gi,
    ],
  };

  async scanCode(code: string, filename: string, language: string): Promise<ScanResult> {
    const startTime = Date.now();
    const vulnerabilities: Vulnerability[] = [];

    const lines = code.split('\n');

    for (const [vulnType, patterns] of Object.entries(this.patterns)) {
      patterns.forEach((pattern) => {
        lines.forEach((line, lineIdx) => {
          const matches = line.matchAll(pattern);
          for (const match of matches) {
            vulnerabilities.push({
              id: `vuln_${Date.now()}_${vulnerabilities.length}`,
              type: vulnType as Vulnerability['type'],
              severity: this.determineSeverity(vulnType),
              line: lineIdx + 1,
              column: match.index || 0,
              message: `Potential ${vulnType} vulnerability detected`,
              code: line.trim(),
              suggestion: this.getSuggestion(vulnType),
            });
          }
        });
      });
    }

    const result: ScanResult = {
      id: `scan_${Date.now()}`,
      filename,
      language,
      vulnerabilities,
      scanTime: Date.now() - startTime,
      timestamp: new Date(),
    };

    this.results.set(result.id, result);
    return result;
  }

  private determineSeverity(vulnType: string): Vulnerability['severity'] {
    const severity: Record<string, Vulnerability['severity']> = {
      'sql-injection': 'critical',
      'command-injection': 'critical',
      xss: 'high',
      'hardcoded-secret': 'high',
      'unsafe-eval': 'medium',
    };

    return severity[vulnType] || 'medium';
  }

  private getSuggestion(vulnType: string): string {
    const suggestions: Record<string, string> = {
      xss: 'Use textContent or innerText instead of innerHTML, or use a templating library',
      'sql-injection': 'Use parameterized queries or an ORM',
      'command-injection': 'Use exec with shell: false or use a library that handles escaping',
      'hardcoded-secret': 'Move secrets to environment variables or a secrets manager',
      'unsafe-eval': 'Avoid eval(); use JSON.parse() or other safe alternatives',
    };

    return suggestions[vulnType] || 'Review and fix this vulnerability';
  }

  getResult(id: string): ScanResult | undefined {
    return this.results.get(id);
  }

  listResults(): ScanResult[] {
    return Array.from(this.results.values());
  }

  getResultsByFile(filename: string): ScanResult[] {
    return Array.from(this.results.values()).filter((r) => r.filename === filename);
  }

  getVulnerabilitiesBySeverity(severity: Vulnerability['severity']): Vulnerability[] {
    const vulns: Vulnerability[] = [];

    this.results.forEach((result) => {
      result.vulnerabilities
        .filter((v) => v.severity === severity)
        .forEach((v) => vulns.push(v));
    });

    return vulns;
  }

  getCriticalVulnerabilities(): Vulnerability[] {
    return this.getVulnerabilitiesBySeverity('critical');
  }
}
