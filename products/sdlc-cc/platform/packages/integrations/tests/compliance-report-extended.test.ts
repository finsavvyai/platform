import { describe, it, expect } from 'vitest';
import {
  generateComplianceReport,
  generateAllComplianceReports,
  exportReportJSON,
  exportReportCSV,
  type PipeWardenFinding,
} from '../src/compliance-report.js';

describe('Compliance Report Extended Tests', () => {
  describe('Mixed Severity Findings', () => {
    it('should generate report with mixed severity findings', () => {
      const mixedFindings: PipeWardenFinding[] = [
        {
          id: 'find-crit',
          category: 'secrets',
          severity: 'critical',
          description: 'AWS key exposed',
          resolved: false,
        },
        {
          id: 'find-high',
          category: 'branch-security',
          severity: 'high',
          description: 'Branch unprotected',
          resolved: false,
        },
        {
          id: 'find-med',
          category: 'missing-tests',
          severity: 'medium',
          description: 'No test coverage',
          resolved: false,
        },
        {
          id: 'find-low',
          category: 'permissions',
          severity: 'low',
          description: 'Excessive permissions',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(mixedFindings, 'SOC2');

      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.failed).toBeGreaterThanOrEqual(2);
      expect(report.mappings.some((m) => m.finding.severity === 'critical')).toBe(true);
      expect(report.mappings.some((m) => m.finding.severity === 'low')).toBe(true);
    });
  });

  describe('SOC2 Control Mapping', () => {
    it('should map secrets to CC6.1 control', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'secret-1',
          category: 'secrets',
          severity: 'critical',
          description: 'Database password in logs',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const cc61Mapping = report.mappings.find((m) => m.control === 'CC6.1');

      expect(cc61Mapping).toBeDefined();
      expect(cc61Mapping?.controlDescription).toContain('logical access');
    });

    it('should map branch-security to CC8.1 control', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'branch-1',
          category: 'branch-security',
          severity: 'high',
          description: 'Main branch allows direct push',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const cc81Mapping = report.mappings.find((m) => m.control === 'CC8.1');

      expect(cc81Mapping).toBeDefined();
      expect(cc81Mapping?.controlDescription).toContain('Detection and prevention');
    });

    it('should map missing-tests to CC7.1 control', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'test-1',
          category: 'missing-tests',
          severity: 'medium',
          description: 'No automated tests',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const cc71Mapping = report.mappings.find((m) => m.control === 'CC7.1');

      expect(cc71Mapping).toBeDefined();
    });

    it('should cover all SOC2 control categories', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'f1',
          category: 'secrets',
          severity: 'critical',
          description: 'test',
          resolved: false,
        },
        {
          id: 'f2',
          category: 'permissions',
          severity: 'high',
          description: 'test',
          resolved: false,
        },
        {
          id: 'f3',
          category: 'branch-security',
          severity: 'high',
          description: 'test',
          resolved: false,
        },
        {
          id: 'f4',
          category: 'missing-tests',
          severity: 'medium',
          description: 'test',
          resolved: false,
        },
        {
          id: 'f5',
          category: 'supply-chain',
          severity: 'medium',
          description: 'test',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const controls = new Set(report.mappings.map((m) => m.control));

      expect(controls.has('CC6.1')).toBe(true);
      expect(controls.has('CC6.3')).toBe(true);
      expect(controls.has('CC8.1')).toBe(true);
    });
  });

  describe('HIPAA Control Mapping', () => {
    it('should map permissions to HIPAA 164.312(a)', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'hipaa-1',
          category: 'permissions',
          severity: 'high',
          description: 'Excessive system access',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'HIPAA');
      const hipaaMapping = report.mappings.find((m) => m.control === '164.312(a)');

      expect(hipaaMapping).toBeDefined();
      expect(hipaaMapping?.controlDescription).toContain('Access Control');
    });

    it('should map secrets to HIPAA 164.308(a)(5)', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'hipaa-sec',
          category: 'secrets',
          severity: 'critical',
          description: 'API key exposed',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'HIPAA');
      const training = report.mappings.find((m) => m.control === '164.308(a)(5)');

      expect(training).toBeDefined();
    });

    it('should have HIPAA-specific remediation', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'h1',
          category: 'secrets',
          severity: 'critical',
          description: 'PHI exposed',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'HIPAA');

      report.mappings.forEach((m) => {
        expect(m.remediation).toBeDefined();
        expect(m.remediation).toContain('Rotate');
      });
    });
  });

  describe('GDPR Control Mapping', () => {
    it('should map secrets to GDPR Art.32', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'gdpr-1',
          category: 'secrets',
          severity: 'critical',
          description: 'Customer data exposed',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'GDPR');
      const art32 = report.mappings.find((m) => m.control === 'Art.32');

      expect(art32).toBeDefined();
      expect(art32?.controlDescription).toContain('Security of processing');
    });

    it('should map branch-security to GDPR Art.32', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'gdpr-2',
          category: 'branch-security',
          severity: 'high',
          description: 'Unapproved changes',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'GDPR');
      const securityMappings = report.mappings.filter((m) => m.control === 'Art.32');

      expect(securityMappings.length).toBeGreaterThan(0);
    });

    it('should include GDPR breach notification requirement', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'gdpr-breach',
          category: 'secrets',
          severity: 'critical',
          description: 'Data exposure',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'GDPR');
      const art33 = report.mappings.find((m) => m.control === 'Art.33');

      expect(art33).toBeDefined();
      expect(art33?.controlDescription).toContain('breach notification');
    });

    it('should map permissions to GDPR Art.5', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'gdpr-perms',
          category: 'permissions',
          severity: 'high',
          description: 'Excessive data access',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'GDPR');
      const principles = report.mappings.filter((m) => m.control === 'Art.5');

      expect(principles.length).toBeGreaterThan(0);
    });
  });

  describe('PCI-DSS Control Mapping', () => {
    it('should map secrets to PCI-DSS 3.4', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'pci-1',
          category: 'secrets',
          severity: 'critical',
          description: 'Credit card data in logs',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'PCI-DSS');
      const pci34 = report.mappings.find((m) => m.control === '3.4');

      expect(pci34).toBeDefined();
      expect(pci34?.controlDescription).toContain('cryptography');
    });

    it('should map missing-tests to PCI-DSS 6.2', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'pci-test',
          category: 'missing-tests',
          severity: 'medium',
          description: 'No security testing',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'PCI-DSS');
      const pci62 = report.mappings.find((m) => m.control === '6.2');

      expect(pci62).toBeDefined();
    });

    it('should map permissions to PCI-DSS 7.1', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'pci-perms',
          category: 'permissions',
          severity: 'high',
          description: 'Overprivileged account',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'PCI-DSS');
      const pci71 = report.mappings.find((m) => m.control === '7.1');

      expect(pci71).toBeDefined();
    });
  });

  describe('exportReportJSON', () => {
    it('should export report with all frameworks', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'test-1',
          category: 'secrets',
          severity: 'critical',
          description: 'Exposed key',
          resolved: false,
        },
      ];

      const frameworks: Array<'SOC2' | 'HIPAA' | 'GDPR' | 'PCI-DSS'> = [
        'SOC2',
        'HIPAA',
        'GDPR',
        'PCI-DSS',
      ];

      frameworks.forEach((framework) => {
        const report = generateComplianceReport(findings, framework);
        const json = exportReportJSON(report);
        const parsed = JSON.parse(json);

        expect(parsed.framework).toBe(framework);
        expect(parsed.generatedAt).toBeDefined();
      });
    });

    it('should preserve all mapping details in JSON export', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'detail-test',
          category: 'permissions',
          severity: 'high',
          description: 'Too much access',
          evidence: 'https://example.com/finding/1',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const json = JSON.parse(exportReportJSON(report));

      expect(json.mappings.length).toBeGreaterThan(0);
      const mapping = json.mappings[0];
      expect(mapping.finding).toBeDefined();
      expect(mapping.control).toBeDefined();
      expect(mapping.remediation).toBeDefined();
    });
  });

  describe('exportReportCSV', () => {
    it('should include all framework columns', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'csv-1',
          category: 'secrets',
          severity: 'critical',
          description: 'test',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const csv = exportReportCSV(report);
      const lines = csv.split('\n');
      const header = lines[0];

      expect(header).toContain('Framework');
      expect(header).toContain('Control');
      expect(header).toContain('Description');
      expect(header).toContain('Status');
      expect(header).toContain('Finding ID');
      expect(header).toContain('Severity');
    });

    it('should export large dataset correctly', () => {
      const findings: PipeWardenFinding[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `finding-${i}`,
          category: 'secrets',
          severity: i % 2 === 0 ? 'critical' : 'high',
          description: `Finding ${i}`,
          resolved: false,
        }),
      );

      const report = generateComplianceReport(findings, 'SOC2');
      const csv = exportReportCSV(report);
      const lines = csv.split('\n').filter((l) => l.length > 0);

      expect(lines.length).toBeGreaterThan(50);
    });

    it('should quote fields containing commas or quotes', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'quote-test',
          category: 'secrets',
          severity: 'critical',
          description: 'Description with "quotes" and, commas',
          resolved: false,
        },
      ];

      const report = generateComplianceReport(findings, 'SOC2');
      const csv = exportReportCSV(report);

      expect(csv).toContain('"');
    });
  });

  describe('Empty and Large Finding Sets', () => {
    it('should handle empty findings', () => {
      const report = generateComplianceReport([], 'SOC2');

      expect(report.framework).toBe('SOC2');
      expect(report.summary.total).toBe(0);
      expect(report.mappings).toHaveLength(0);
    });

    it('should handle very large finding sets (100+)', () => {
      const findings: PipeWardenFinding[] = Array.from(
        { length: 150 },
        (_, i) => ({
          id: `large-${i}`,
          category:
            ['secrets', 'branch-security', 'missing-tests', 'permissions', 'supply-chain'][
              i % 5
            ] as any,
          severity: ['critical', 'high', 'medium', 'low'][i % 4] as any,
          description: `Large dataset finding ${i}`,
          resolved: i % 10 === 0,
        }),
      );

      const report = generateComplianceReport(findings, 'GDPR');

      expect(report.mappings.length).toBeGreaterThan(100);
      expect(report.summary.total).toBeGreaterThan(100);
    });

    it('should correctly summarize large finding sets', () => {
      const findings: PipeWardenFinding[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `sum-${i}`,
          category: 'secrets',
          severity: i < 50 ? 'critical' : 'low',
          description: `Test ${i}`,
          resolved: i % 5 === 0,
        }),
      );

      const report = generateComplianceReport(findings, 'PCI-DSS');

      expect(report.summary.passed).toBeGreaterThan(0);
      expect(report.summary.failed).toBeGreaterThan(0);
      expect(
        report.summary.passed + report.summary.failed + report.summary.partial
      ).toBe(report.summary.total);
    });
  });

  describe('All Frameworks Report Generation', () => {
    it('should generate consistent reports across frameworks', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'f1',
          category: 'secrets',
          severity: 'critical',
          description: 'test',
          resolved: false,
        },
        {
          id: 'f2',
          category: 'permissions',
          severity: 'high',
          description: 'test',
          resolved: false,
        },
        {
          id: 'f3',
          category: 'branch-security',
          severity: 'medium',
          description: 'test',
          resolved: true,
        },
      ];

      const reports = generateAllComplianceReports(findings);

      expect(reports).toHaveLength(4);
      reports.forEach((report) => {
        expect(report.summary.passed + report.summary.failed + report.summary.partial).toBe(
          report.summary.total,
        );
        expect(report.generatedAt).toBeInstanceOf(Date);
      });
    });

    it('should have different mappings per framework', () => {
      const findings: PipeWardenFinding[] = [
        {
          id: 'multi',
          category: 'secrets',
          severity: 'critical',
          description: 'test',
          resolved: false,
        },
      ];

      const reports = generateAllComplianceReports(findings);

      const soc2Controls = new Set(reports[0].mappings.map((m) => m.control));
      const hipaaControls = new Set(reports[1].mappings.map((m) => m.control));

      expect(soc2Controls.size).toBeGreaterThan(0);
      expect(hipaaControls.size).toBeGreaterThan(0);

      const shared = Array.from(soc2Controls).filter((c) => hipaaControls.has(c));
      expect(shared.length).toBeLessThan(soc2Controls.size);
    });
  });
});
