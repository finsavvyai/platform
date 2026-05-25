import { describe, it, expect, beforeEach } from 'vitest';
import { ReportGenerator } from '../src/services/reporter';
import { Vulnerability } from '../src/services/scanner';

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  const mockVulnerabilities: Vulnerability[] = [
    {
      id: 'v1',
      type: 'xss',
      severity: 'high',
      line: 10,
      column: 5,
      message: 'XSS vulnerability',
      code: 'innerHTML = x;',
    },
    {
      id: 'v2',
      type: 'sql-injection',
      severity: 'critical',
      line: 20,
      column: 0,
      message: 'SQL injection',
      code: "query(sql + input);",
    },
  ];

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  it('should generate JSON report', () => {
    const json = generator.generateJSONReport('test.js', mockVulnerabilities);

    expect(json).toContain('test.js');
    expect(json).toContain('xss');
    expect(json).toContain('sql-injection');
  });

  it('should generate SARIF report', () => {
    const sarif = generator.generateSARIFReport('test.js', mockVulnerabilities);

    expect(sarif).toContain('2.1.0');
    expect(sarif).toContain('Code Safety Suite');
    expect(sarif).toContain('test.js');
  });

  it('should generate HTML report', () => {
    const html = generator.generateHTMLReport('test.js', mockVulnerabilities);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('test.js');
    expect(html).toContain('xss');
    expect(html).toContain('critical');
  });

  it('should generate Markdown report', () => {
    const md = generator.generateMarkdownReport('test.js', mockVulnerabilities);

    expect(md).toContain('# Security Report');
    expect(md).toContain('test.js');
    expect(md).toContain('XSS');
    expect(md).toContain('SQL');
  });

  it('should create report with JSON format', () => {
    const report = generator.createReport('test.js', mockVulnerabilities, 'json');

    expect(report.format).toBe('json');
    expect(report.vulnerabilities).toBe(2);
    expect(report.criticalCount).toBe(1);
  });

  it('should create report with HTML format', () => {
    const report = generator.createReport('test.js', mockVulnerabilities, 'html');

    expect(report.format).toBe('html');
    expect(report.content).toContain('<!DOCTYPE html>');
  });

  it('should get report by id', () => {
    const report = generator.createReport('test.js', mockVulnerabilities, 'json');

    const retrieved = generator.getReport(report.id);

    expect(retrieved?.id).toBe(report.id);
  });

  it('should list all reports', () => {
    generator.createReport('test1.js', mockVulnerabilities, 'json');
    generator.createReport('test2.js', mockVulnerabilities, 'html');

    const reports = generator.listReports();

    expect(reports.length).toBeGreaterThanOrEqual(2);
  });

  it('should delete report', () => {
    const report = generator.createReport('test.js', mockVulnerabilities, 'json');

    const deleted = generator.deleteReport(report.id);

    expect(deleted).toBe(true);
    expect(generator.getReport(report.id)).toBeUndefined();
  });

  it('should count critical vulnerabilities in report', () => {
    const report = generator.createReport('test.js', mockVulnerabilities, 'json');

    expect(report.criticalCount).toBe(1);
  });

  it('should track timestamp in report', () => {
    const report = generator.createReport('test.js', mockVulnerabilities, 'json');

    expect(report.timestamp).toBeInstanceOf(Date);
  });
});
