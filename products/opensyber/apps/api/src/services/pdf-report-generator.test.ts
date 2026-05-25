import { describe, it, expect } from 'vitest';
import { generatePdfReport } from './pdf-report-generator.js';

describe('HTML Report Generator', () => {
  it('should generate valid HTML string with org name', async () => {
    const input = {
      orgName: 'Test Organization',
      agentSummary: {
        total: 100,
        critical: 5,
        high: 15,
        medium: 30,
        low: 50,
        secretsDetected: 2,
      },
      cspmSummary: {
        critical: 3,
        high: 12,
        medium: 25,
        low: 40,
      },
      score: {
        agentScore: 65,
        cspmScore: 70,
        combined: 68,
        grade: 'C' as const,
      },
      violations: [
        { summary: 'AWS credentials file accessed', severity: 'high', createdAt: '2026-03-04' },
        { summary: 'S3 bucket public access', severity: 'critical', createdAt: '2026-03-03' },
      ],
    };

    const result = await generatePdfReport(input);

    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('Test Organization');
    expect(result).toContain('grade-C');
    expect(result).toContain('65');
    expect(result).toContain('AWS credentials file accessed');
  });

  it('should handle empty violations list', async () => {
    const input = {
      orgName: 'Empty Org',
      agentSummary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 },
      cspmSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      score: { agentScore: 100, cspmScore: 100, combined: 100, grade: 'A' as const },
      violations: [],
    };

    const result = await generatePdfReport(input);

    expect(typeof result).toBe('string');
    expect(result).toContain('Empty Org');
    expect(result).toContain('No violations found');
  });

  it('should render grade F with correct styling', async () => {
    const input = {
      orgName: 'Critical Org',
      agentSummary: { total: 200, critical: 50, high: 60, medium: 40, low: 50, secretsDetected: 10 },
      cspmSummary: { critical: 40, high: 50, medium: 30, low: 20 },
      score: { agentScore: 20, cspmScore: 25, combined: 23, grade: 'F' as const },
      violations: Array.from({ length: 25 }, (_, i) => ({
        summary: `Violation ${i + 1}`,
        severity: i < 10 ? 'critical' : i < 20 ? 'high' : 'medium',
        createdAt: '2026-03-04',
      })),
    };

    const result = await generatePdfReport(input);

    expect(result).toContain('Critical Org');
    expect(result).toContain('grade-F');
    expect(result).toContain('Violation 1');
  });

  it('should render grade A with correct styling', async () => {
    const input = {
      orgName: 'Secure Org',
      agentSummary: { total: 10, critical: 0, high: 0, medium: 2, low: 8, secretsDetected: 0 },
      cspmSummary: { critical: 0, high: 0, medium: 1, low: 2 },
      score: { agentScore: 95, cspmScore: 98, combined: 96, grade: 'A' as const },
      violations: [],
    };

    const result = await generatePdfReport(input);

    expect(result).toContain('Secure Org');
    expect(result).toContain('grade-A');
    expect(result).toContain('95');
  });
});
