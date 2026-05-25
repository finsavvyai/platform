/**
 * Report Generator - Generate comprehensive test reports in multiple formats
 *
 * Supported formats:
 * - JUnit XML (for CI/CD pipelines)
 * - HTML with charts and trends
 * - Allure-compatible JSON
 * - JSON with full details
 * - CSV for spreadsheet export
 *
 * Features:
 * - Executive summary with KPIs
 * - Trend analysis (improving/degrading/stable)
 * - Failure root cause analysis
 * - Performance metrics
 * - Daily/weekly/monthly reports
 */

import { logger } from '../../utils/logger.js';

/**
 * Report metadata
 */
export interface ReportMetadata {
  title: string;
  projectId: string;
  projectName: string;
  generatedAt: number;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: number;
  endDate: number;
  reportedBy?: string;
}

/**
 * Executive summary with KPIs
 */
export interface ExecutiveSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: number;
  failRate: number;
  avgDuration: number;
  totalDuration: number;
  flakeRate: number;
  trend: 'improving' | 'degrading' | 'stable';
  previousPeriodPassRate: number;
  passRateChange: number;
  topFailures: FailureSummary[];
  slowestTests: SlowTestSummary[];
  flakyTests: FlakyTestSummary[];
}

/**
 * Failure summary for report
 */
export interface FailureSummary {
  testName: string;
  failureCount: number;
  lastFailureTime: number;
  rootCause: string;
  errorMessage: string;
}

/**
 * Slow test summary
 */
export interface SlowTestSummary {
  testName: string;
  avgDuration: number;
  maxDuration: number;
  percentile: number;
}

/**
 * Flaky test summary
 */
export interface FlakyTestSummary {
  testName: string;
  flakiness: number;
  failureCount: number;
  totalRuns: number;
}

/**
 * Trend data for visualization
 */
export interface TrendData {
  date: string;
  passRate: number;
  failRate: number;
  avgDuration: number;
  testCount: number;
}

/**
 * Test result for detailed reporting
 */
export interface TestResultDetail {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  errorStack?: string;
  retries: number;
  environment: string;
  tags: string[];
  timestamp: number;
}

/**
 * Complete report object
 */
export interface Report {
  metadata: ReportMetadata;
  summary: ExecutiveSummary;
  trends: TrendData[];
  testResults: TestResultDetail[];
  recommendations: string[];
}

/**
 * Export format type
 */
export type ReportFormat = 'junit' | 'html' | 'allure' | 'json' | 'csv';

/**
 * Report Generator Service
 */
export class ReportGenerator {
  constructor() {}

  /**
   * Generate report in specified format
   */
  async generateReport(
    report: Report,
    format: ReportFormat,
  ): Promise<string> {
    try {
      switch (format) {
        case 'junit':
          return this.generateJunitXML(report);
        case 'html':
          return this.generateHTML(report);
        case 'allure':
          return this.generateAllureJSON(report);
        case 'json':
          return this.generateJSON(report);
        case 'csv':
          return this.generateCSV(report);
        default:
          throw new Error(`Unsupported report format: ${format}`);
      }
    } catch (error) {
      logger.error(`[ReportGenerator] Failed to generate ${format} report:`, error);
      throw error;
    }
  }

  /**
   * Generate JUnit XML format (compatible with CI/CD systems)
   */
  private generateJunitXML(report: Report): string {
    const { metadata, summary, testResults } = report;
    const timestamp = new Date(metadata.generatedAt).toISOString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="${escapeXml(metadata.projectName)}" `;
    xml += `tests="${summary.totalTests}" `;
    xml += `failures="${summary.failedTests}" `;
    xml += `skipped="${summary.skippedTests}" `;
    xml += `time="${summary.totalDuration / 1000}" `;
    xml += `timestamp="${timestamp}">\n`;

    xml += `  <testsuite name="${escapeXml(metadata.projectName)}" `;
    xml += `tests="${summary.totalTests}" `;
    xml += `failures="${summary.failedTests}" `;
    xml += `skipped="${summary.skippedTests}" `;
    xml += `time="${summary.totalDuration / 1000}">\n`;

    // Add properties
    xml += '    <properties>\n';
    xml += `      <property name="passRate" value="${summary.passRate.toFixed(2)}%"/>\n`;
    xml += `      <property name="flakeRate" value="${summary.flakeRate.toFixed(2)}%"/>\n`;
    xml += `      <property name="trend" value="${report.summary.trend}"/>\n`;
    xml += `      <property name="period" value="${metadata.period}"/>\n`;
    xml += '    </properties>\n';

    // Add test cases
    for (const test of testResults) {
      xml += `    <testcase name="${escapeXml(test.name)}" `;
      xml += `time="${test.duration / 1000}" `;
      xml += `classname="${escapeXml(metadata.projectName)}">\n`;

      if (test.status === 'failed') {
        xml += `      <failure message="${escapeXml(test.errorMessage || '')}">`;
        xml += escapeXml(test.errorStack || '');
        xml += '</failure>\n';
      }

      if (test.status === 'skipped') {
        xml += '      <skipped/>\n';
      }

      xml += '    </testcase>\n';
    }

    xml += '  </testsuite>\n';
    xml += '</testsuites>';

    return xml;
  }

  /**
   * Generate HTML report with embedded charts
   */
  private generateHTML(report: Report): string {
    const { metadata, summary, trends } = report;
    const trendChart = JSON.stringify(
      trends.map((t) => ({
        date: t.date,
        passRate: t.passRate,
        failRate: t.failRate,
      })),
    );

    let html = '<!DOCTYPE html>\n<html>\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += `<title>Test Report - ${escapeHtml(metadata.projectName)}</title>\n`;
    html += '<style>\n';
    html += this.getHTMLStyles();
    html += '</style>\n';
    html += '</head>\n<body>\n';

    // Header
    html += `<h1>Test Report: ${escapeHtml(metadata.projectName)}</h1>\n`;
    html += `<p class="subtitle">Generated: ${new Date(metadata.generatedAt).toLocaleString()}</p>\n`;

    // Executive Summary
    html += '<section class="summary">\n';
    html += '<h2>Executive Summary</h2>\n';
    html += '<div class="metrics">\n';
    html += `<div class="metric"><span class="label">Total Tests</span><span class="value">${summary.totalTests}</span></div>\n`;
    html += `<div class="metric"><span class="label">Pass Rate</span><span class="value">${summary.passRate.toFixed(1)}%</span></div>\n`;
    html += `<div class="metric"><span class="label">Failed</span><span class="value">${summary.failedTests}</span></div>\n`;
    html += `<div class="metric"><span class="label">Avg Duration</span><span class="value">${(summary.avgDuration / 1000).toFixed(2)}s</span></div>\n`;
    html += '</div>\n';
    html += '</section>\n';

    // Trend Analysis
    html += '<section class="trends">\n';
    html += '<h2>Trend Analysis</h2>\n';
    html += `<p class="trend ${report.summary.trend}">${report.summary.trend.toUpperCase()}</p>\n`;
    html += `<p>Pass Rate Change: ${report.summary.passRateChange > 0 ? '+' : ''}${report.summary.passRateChange.toFixed(2)}%</p>\n`;
    html += '</section>\n';

    // Top Failures
    if (summary.topFailures.length > 0) {
      html += '<section class="failures">\n';
      html += '<h2>Top Failures</h2>\n';
      html += '<ul>\n';
      for (const failure of summary.topFailures.slice(0, 5)) {
        html += `<li><strong>${escapeHtml(failure.testName)}</strong> (${failure.failureCount} times): ${escapeHtml(failure.errorMessage)}</li>\n`;
      }
      html += '</ul>\n';
      html += '</section>\n';
    }

    html += '<footer><p>Generated by Qestro Analytics Engine</p></footer>\n';
    html += '</body>\n</html>';

    return html;
  }

  /**
   * Generate Allure-compatible JSON format
   */
  private generateAllureJSON(report: Report): string {
    const { metadata, summary, testResults } = report;

    const allureResults = testResults.map((test) => ({
      uuid: test.id,
      name: test.name,
      status: test.status,
      stage: 'finished',
      steps: [],
      attachments: [],
      labels: [
        { name: 'suite', value: metadata.projectName },
        { name: 'thread', value: test.environment },
        { name: 'host', value: 'qestro' },
      ],
      parameters: [],
      start: test.timestamp,
      stop: test.timestamp + test.duration,
      duration: test.duration,
      fullName: `${metadata.projectName}.${test.name}`,
      description: test.status === 'failed' ? test.errorMessage : undefined,
    }));

    return JSON.stringify(allureResults, null, 2);
  }

  /**
   * Generate JSON report
   */
  private generateJSON(report: Report): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate CSV report
   */
  private generateCSV(report: Report): string {
    const { testResults } = report;

    let csv = 'Test Name,Status,Duration (ms),Environment,Timestamp,Error Message\n';

    for (const test of testResults) {
      const errorMsg = test.errorMessage ? `"${test.errorMessage.replace(/"/g, '""')}"` : '';
      csv += `"${test.name.replace(/"/g, '""')}",${test.status},${test.duration},${test.environment},${new Date(test.timestamp).toISOString()},${errorMsg}\n`;
    }

    return csv;
  }

  /**
   * Generate daily QA summary report
   */
  async generateDailySummary(
    projectId: string,
    projectName: string,
    date: number,
    summary: ExecutiveSummary,
    trends: TrendData[],
  ): Promise<Report> {
    return {
      metadata: {
        title: `Daily QA Summary - ${new Date(date).toDateString()}`,
        projectId,
        projectName,
        generatedAt: Date.now(),
        period: 'daily',
        startDate: date,
        endDate: date + 24 * 60 * 60 * 1000,
      },
      summary,
      trends,
      testResults: [],
      recommendations: this.generateRecommendations(summary),
    };
  }

  /**
   * Generate weekly QA summary report
   */
  async generateWeeklySummary(
    projectId: string,
    projectName: string,
    weekStart: number,
    summary: ExecutiveSummary,
    trends: TrendData[],
  ): Promise<Report> {
    return {
      metadata: {
        title: `Weekly QA Summary - Week of ${new Date(weekStart).toDateString()}`,
        projectId,
        projectName,
        generatedAt: Date.now(),
        period: 'weekly',
        startDate: weekStart,
        endDate: weekStart + 7 * 24 * 60 * 60 * 1000,
      },
      summary,
      trends,
      testResults: [],
      recommendations: this.generateRecommendations(summary),
    };
  }

  /**
   * Generate recommendations based on summary
   */
  private generateRecommendations(summary: ExecutiveSummary): string[] {
    const recommendations: string[] = [];

    if (summary.passRate < 80) {
      recommendations.push(
        'Pass rate is below 80%. Investigate recent test failures and prioritize fixes.',
      );
    }

    if (summary.flakeRate > 10) {
      recommendations.push(
        `Flake rate is ${summary.flakeRate.toFixed(1)}%. Review and stabilize flaky tests.`,
      );
    }

    if (summary.trend === 'degrading') {
      recommendations.push('Test quality is degrading. Review recent code changes and test coverage.');
    }

    if (summary.slowestTests.length > 0 && summary.slowestTests[0].avgDuration > 30000) {
      recommendations.push('Some tests are running slow (>30s). Consider optimization.');
    }

    if (summary.topFailures.length > 0) {
      recommendations.push(
        `Top ${summary.topFailures.length} failures account for ${Math.round((summary.topFailures.length / summary.failedTests) * 100)}% of failures.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All metrics are healthy. Continue monitoring test quality.');
    }

    return recommendations;
  }

  /**
   * HTML styles for reports
   */
  private getHTMLStyles(): string {
    return `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: #f5f5f5;
  color: #333;
}
h1 { color: #1a73e8; margin: 0 0 10px 0; }
h2 { color: #202124; margin: 20px 0 15px 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
.subtitle { color: #999; margin: 0; }
section { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
.metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px; }
.metric .label { display: block; color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
.metric .value { display: block; font-size: 24px; font-weight: bold; color: #1a73e8; }
.trend { font-size: 18px; font-weight: bold; padding: 10px; border-radius: 4px; display: inline-block; }
.trend.improving { background: #e8f5e9; color: #2e7d32; }
.trend.degrading { background: #ffebee; color: #c62828; }
.trend.stable { background: #e3f2fd; color: #1565c0; }
ul { list-style: none; padding: 0; }
li { padding: 10px; background: #f8f9fa; border-left: 4px solid #f44336; margin: 8px 0; border-radius: 4px; }
footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
`;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return escapeHtml(text);
}

/**
 * Export singleton instance
 */
export const reportGenerator = new ReportGenerator();
