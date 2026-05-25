// Generate reports: JSON, SARIF, HTML, markdown
import { Vulnerability } from './scanner';
import { RuleMatch } from './rule-engine';

export interface Report {
  id: string;
  timestamp: Date;
  filename: string;
  format: 'json' | 'sarif' | 'html' | 'markdown';
  content: string;
  vulnerabilities: number;
  criticalCount: number;
}

export class ReportGenerator {
  private reports: Map<string, Report> = new Map();

  generateJSONReport(filename: string, vulnerabilities: Vulnerability[]): string {
    return JSON.stringify(
      {
        filename,
        timestamp: new Date().toISOString(),
        vulnerabilityCount: vulnerabilities.length,
        vulnerabilities: vulnerabilities.map((v) => ({
          type: v.type,
          severity: v.severity,
          line: v.line,
          column: v.column,
          message: v.message,
          code: v.code,
          suggestion: v.suggestion,
        })),
      },
      null,
      2
    );
  }

  generateSARIFReport(filename: string, vulnerabilities: Vulnerability[]): string {
    const results = vulnerabilities.map((v) => ({
      ruleId: v.type,
      level: v.severity === 'critical' ? 'error' : v.severity === 'high' ? 'warning' : 'note',
      message: { text: v.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: filename },
            region: {
              startLine: v.line,
              startColumn: v.column,
            },
          },
        },
      ],
    }));

    return JSON.stringify(
      {
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'Code Safety Suite',
                version: '1.0.0',
              },
            },
            results,
          },
        ],
      },
      null,
      2
    );
  }

  generateHTMLReport(filename: string, vulnerabilities: Vulnerability[]): string {
    const criticalCount = vulnerabilities.filter((v) => v.severity === 'critical').length;

    return `<!DOCTYPE html>
<html>
<head>
  <title>Security Report - ${filename}</title>
  <style>
    body { font-family: system-ui; margin: 20px; }
    .header { margin-bottom: 30px; }
    .critical { color: #d32f2f; }
    .high { color: #f57c00; }
    .medium { color: #fbc02d; }
    .vulnerability { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Report</h1>
    <p>File: <strong>${filename}</strong></p>
    <p>Generated: <strong>${new Date().toISOString()}</strong></p>
    <p class="critical">Critical Issues: <strong>${criticalCount}</strong></p>
  </div>
  <div class="vulnerabilities">
    ${vulnerabilities
      .map(
        (v) => `
    <div class="vulnerability ${v.severity}">
      <h3>${v.type}</h3>
      <p><strong>Line ${v.line}:</strong> ${v.message}</p>
      <code>${v.code}</code>
      ${v.suggestion ? `<p><strong>Suggestion:</strong> ${v.suggestion}</p>` : ''}
    </div>
    `
      )
      .join('')}
  </div>
</body>
</html>`;
  }

  generateMarkdownReport(filename: string, vulnerabilities: Vulnerability[]): string {
    const criticalCount = vulnerabilities.filter((v) => v.severity === 'critical').length;

    let report = `# Security Report\n\n`;
    report += `**File:** ${filename}\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `**Critical Issues:** ${criticalCount}\n\n`;
    report += `## Vulnerabilities\n\n`;

    vulnerabilities.forEach((v) => {
      report += `### ${v.type.toUpperCase()} (${v.severity})\n\n`;
      report += `- **Line:** ${v.line}\n`;
      report += `- **Message:** ${v.message}\n`;
      report += `- **Code:** \`${v.code}\`\n`;
      if (v.suggestion) {
        report += `- **Suggestion:** ${v.suggestion}\n`;
      }
      report += `\n`;
    });

    return report;
  }

  createReport(
    filename: string,
    vulnerabilities: Vulnerability[],
    format: 'json' | 'sarif' | 'html' | 'markdown'
  ): Report {
    let content: string;

    switch (format) {
      case 'sarif':
        content = this.generateSARIFReport(filename, vulnerabilities);
        break;
      case 'html':
        content = this.generateHTMLReport(filename, vulnerabilities);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(filename, vulnerabilities);
        break;
      case 'json':
      default:
        content = this.generateJSONReport(filename, vulnerabilities);
    }

    const criticalCount = vulnerabilities.filter((v) => v.severity === 'critical').length;

    const report: Report = {
      id: `report_${Date.now()}`,
      timestamp: new Date(),
      filename,
      format,
      content,
      vulnerabilities: vulnerabilities.length,
      criticalCount,
    };

    this.reports.set(report.id, report);
    return report;
  }

  getReport(id: string): Report | undefined {
    return this.reports.get(id);
  }

  listReports(): Report[] {
    return Array.from(this.reports.values());
  }

  deleteReport(id: string): boolean {
    return this.reports.delete(id);
  }
}
