/**
 * Serialization helpers for compliance reports.
 */

import type { ComplianceReport } from './compliance-report-types';

/** Export compliance report to JSON. */
export function exportReportJSON(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2);
}

/** Export compliance report to CSV. */
export function exportReportCSV(report: ComplianceReport): string {
  const headers = [
    'Framework',
    'Control',
    'Description',
    'Status',
    'Finding ID',
    'Severity',
  ];
  const rows = report.mappings.map((m) => [
    m.framework,
    m.control,
    m.controlDescription,
    m.status,
    m.finding.id,
    m.finding.severity,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');
  return csv;
}
