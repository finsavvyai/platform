import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportComplianceToCsv, buildExportKey } from './report-export.js';
import type { ComplianceControlResult } from '@opensyber/shared';

describe('report-export service', () => {
  describe('exportComplianceToCsv', () => {
    it('generates valid CSV with headers', () => {
      const results: ComplianceControlResult[] = [
        { controlId: 'soc2-cc1.1', name: 'Security Policy', category: 'Common Criteria', status: 'pass', evidence: 'Active policies configured' },
        { controlId: 'soc2-cc3.1', name: 'Risk Assessment', category: 'Risk Assessment', status: 'fail', evidence: '3 open vulnerabilities' },
      ];
      const csv = exportComplianceToCsv(results, 'soc2');
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Control ID,Name,Category,Status,Evidence,Framework');
      expect(lines.length).toBe(3); // header + 2 data rows
      expect(lines[1]).toContain('soc2-cc1.1');
      expect(lines[1]).toContain('pass');
      expect(lines[2]).toContain('fail');
    });

    it('escapes CSV values with commas', () => {
      const results: ComplianceControlResult[] = [
        { controlId: 'test-1', name: 'Test, with comma', category: 'Cat', status: 'pass', evidence: 'OK' },
      ];
      const csv = exportComplianceToCsv(results, 'test');
      expect(csv).toContain('"Test, with comma"');
    });

    it('escapes CSV values with double quotes', () => {
      const results: ComplianceControlResult[] = [
        { controlId: 'test-1', name: 'Test "quoted"', category: 'Cat', status: 'pass', evidence: 'OK' },
      ];
      const csv = exportComplianceToCsv(results, 'test');
      expect(csv).toContain('"Test ""quoted"""');
    });

    it('returns header only for empty results', () => {
      const csv = exportComplianceToCsv([], 'soc2');
      const lines = csv.split('\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('Control ID');
    });
  });

  describe('buildExportKey', () => {
    it('generates compliance export key', () => {
      const key = buildExportKey('inst-1', 'compliance', 'soc2');
      expect(key).toMatch(/^exports\/inst-1\/compliance-soc2-\d+\.csv$/);
    });

    it('generates audit export key without framework', () => {
      const key = buildExportKey('inst-1', 'audit');
      expect(key).toMatch(/^exports\/inst-1\/audit-\d+\.csv$/);
    });
  });
});
