import { describe, it, expect } from 'vitest';
import {
  generateComplianceReport,
  generateAllComplianceReports,
  exportReportJSON,
  exportReportCSV,
  type PipeWardenFinding,
  type ComplianceReport,
} from '../src/compliance-report.js';

describe('Compliance Report Generator', () => {
  const mockFindings: PipeWardenFinding[] = [
    {
      id: 'finding-1',
      category: 'secrets',
      severity: 'critical',
      description: 'AWS credentials found in source code',
      evidence: 'https://pipewarden.example.com/findings/1',
      resolved: false,
    },
    {
      id: 'finding-2',
      category: 'branch-security',
      severity: 'high',
      description: 'Main branch allows direct pushes',
      resolved: false,
    },
    {
      id: 'finding-3',
      category: 'missing-tests',
      severity: 'medium',
      description: 'Deployment pipeline lacks test coverage',
      resolved: false,
    },
    {
      id: 'finding-4',
      category: 'permissions',
      severity: 'high',
      description: 'Excessive permissions in CI/CD service account',
      resolved: true,
    },
  ];

  describe('generateComplianceReport', () => {
    it('should generate SOC2 compliance report', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');

      expect(report.framework).toBe('SOC2');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.mappings.length).toBeGreaterThan(0);
    });

    it('should mark resolved findings as pass', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const resolvedMapping = report.mappings.find(
        (m) => m.finding.id === 'finding-4'
      );

      expect(resolvedMapping?.status).toBe('pass');
    });

    it('should mark critical findings as fail', () => {
      const report = generateComplianceReport(mockFindings, 'GDPR');
      const criticalMapping = report.mappings.find(
        (m) => m.finding.id === 'finding-1'
      );

      expect(criticalMapping?.status).toBe('fail');
    });

    it('should map secrets findings to SOC2 CC6.1', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const secretsMapping = report.mappings.find(
        (m) => m.finding.id === 'finding-1' && m.control === 'CC6.1'
      );

      expect(secretsMapping).toBeDefined();
      expect(secretsMapping?.controlDescription).toContain('logical access');
    });

    it('should map branch-security findings to SOC2 CC8.1', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const branchMapping = report.mappings.find(
        (m) => m.finding.id === 'finding-2' && m.control === 'CC8.1'
      );

      expect(branchMapping).toBeDefined();
    });

    it('should include remediation guidance', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const mapping = report.mappings[0];

      expect(mapping.remediation).toBeDefined();
      expect(mapping.remediation?.length).toBeGreaterThan(0);
    });

    it('should calculate summary statistics correctly', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');

      expect(report.summary.passed).toBeGreaterThanOrEqual(0);
      expect(report.summary.failed).toBeGreaterThanOrEqual(0);
      expect(report.summary.partial).toBeGreaterThanOrEqual(0);
      expect(
        report.summary.passed + report.summary.failed + report.summary.partial
      ).toBe(report.summary.total);
    });

    it('should generate HIPAA compliance report', () => {
      const report = generateComplianceReport(mockFindings, 'HIPAA');

      expect(report.framework).toBe('HIPAA');
      expect(report.mappings.length).toBeGreaterThan(0);
      expect(
        report.mappings.some((m) => m.control.includes('164'))
      ).toBeTruthy();
    });

    it('should generate PCI-DSS compliance report', () => {
      const report = generateComplianceReport(mockFindings, 'PCI-DSS');

      expect(report.framework).toBe('PCI-DSS');
      expect(report.mappings.length).toBeGreaterThan(0);
      expect(report.mappings.some((m) => m.control === '3.4')).toBeTruthy();
    });
  });

  describe('generateAllComplianceReports', () => {
    it('should generate reports for all frameworks', () => {
      const reports = generateAllComplianceReports(mockFindings);

      expect(reports.length).toBe(4);
      expect(reports.map((r) => r.framework)).toEqual([
        'SOC2',
        'HIPAA',
        'GDPR',
        'PCI-DSS',
      ]);
    });

    it('each report should have consistent data', () => {
      const reports = generateAllComplianceReports(mockFindings);

      reports.forEach((report) => {
        expect(report.generatedAt).toBeInstanceOf(Date);
        expect(report.summary.total).toBeGreaterThan(0);
        expect(report.mappings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('exportReportJSON', () => {
    it('should export valid JSON', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const json = exportReportJSON(report);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('exported JSON should contain all data', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const json = JSON.parse(exportReportJSON(report));

      expect(json.framework).toBe('SOC2');
      expect(json.summary).toBeDefined();
      expect(json.mappings).toBeDefined();
      expect(Array.isArray(json.mappings)).toBeTruthy();
    });
  });

  describe('exportReportCSV', () => {
    it('should export valid CSV', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const csv = exportReportCSV(report);

      expect(csv).toBeDefined();
      expect(csv.length).toBeGreaterThan(0);
    });

    it('CSV should contain headers and data rows', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const csv = exportReportCSV(report);
      const lines = csv.split('\n');

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain('Framework');
      expect(lines[0]).toContain('Control');
      expect(lines[0]).toContain('Status');
    });

    it('CSV rows should match number of mappings', () => {
      const report = generateComplianceReport(mockFindings, 'SOC2');
      const csv = exportReportCSV(report);
      const lines = csv.split('\n').filter((line) => line.length > 0);

      // +1 for header row
      expect(lines.length).toBe(report.mappings.length + 1);
    });
  });
});
