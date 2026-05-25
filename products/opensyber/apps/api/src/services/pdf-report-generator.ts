/**
 * HTML Security Report Generator
 *
 * Produces a dark-themed HTML report with executive summary,
 * risk tables, and violations list. Workers-compatible (no DOM dependencies).
 */

import type { PdfReportInput } from './pdf-report-types.js';

/**
 * Generate an HTML security report string.
 * Compatible with Cloudflare Workers (no DOM dependencies).
 */
export async function generatePdfReport(input: PdfReportInput): Promise<string> {
  const now = new Date().toISOString().split('T')[0];
  const gradeClass = `grade-${input.score.grade}`;
  const violationRows = input.violations
    .slice(0, 20)
    .map((v) => `<tr><td>${v.severity.toUpperCase()}</td><td>${v.summary}</td><td>${v.createdAt}</td></tr>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Security Report - ${input.orgName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6;padding:2rem}
    .container{max-width:900px;margin:0 auto}
    h1{color:#fff;font-size:2.5rem;margin-bottom:1rem}
    h2{color:#fff;font-size:1.75rem;margin:2rem 0 1rem}
    .meta{color:#b3b3b3;margin-bottom:2rem;font-size:0.95rem}
    .section{background:#111;border:1px solid #333;border-radius:8px;padding:1.5rem;margin-bottom:1.5rem}
    table{width:100%;border-collapse:collapse;margin-top:1rem}
    th,td{border:1px solid #333;padding:12px;text-align:left}
    th{background:#1a1a1a;font-weight:600;color:#fff}
    td{color:#d4d4d4}
    .grade{font-size:4rem;font-weight:700;text-align:center;margin:1.5rem 0}
    .grade-A{color:#22c55e}
    .grade-B{color:#3b82f6}
    .grade-C{color:#f59e0b}
    .grade-D{color:#ef4444}
    .grade-F{color:#dc2626}
    .score-card{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-top:1rem}
    .score-item{background:#1a1a1a;padding:1rem;border-radius:4px;border:1px solid #333}
    .score-label{color:#b3b3b3;font-size:0.85rem;text-transform:uppercase;margin-bottom:0.5rem}
    .score-value{color:#fff;font-size:1.5rem;font-weight:600}
    ul{margin-left:1.5rem;margin-top:1rem}
    li{margin-bottom:0.75rem;color:#d4d4d4}
    footer{color:#666;font-size:0.85rem;margin-top:3rem;padding-top:1.5rem;border-top:1px solid #333}
    @media print{body{padding:0;background:#fff;color:#000}h1,h2,th,footer{color:#000}.section{background:#f9f9f9;border:1px solid #ccc}.grade,.grade-A,.grade-B,.grade-C,.grade-D,.grade-F{color:#333}}
  </style>
</head>
<body>
  <div class="container">
    <h1>OpenSyber Security Report</h1>
    <div class="meta">Organization: <strong>${input.orgName}</strong> | Date: ${now}</div>

    <div class="section">
      <h2>Security Rating</h2>
      <div class="grade ${gradeClass}">${input.score.grade}</div>
      <p>Combined Score: <strong>${input.score.combined}/100</strong></p>
      <div class="score-card">
        <div class="score-item">
          <div class="score-label">Agent Score</div>
          <div class="score-value">${input.score.agentScore}</div>
        </div>
        <div class="score-item">
          <div class="score-label">CSPM Score</div>
          <div class="score-value">${input.score.cspmScore}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Agent Activity Risk</h2>
      <table>
        <thead>
          <tr><th>Severity</th><th>Count</th></tr>
        </thead>
        <tbody>
          <tr><td>Critical</td><td>${input.agentSummary.critical}</td></tr>
          <tr><td>High</td><td>${input.agentSummary.high}</td></tr>
          <tr><td>Medium</td><td>${input.agentSummary.medium}</td></tr>
          <tr><td>Low</td><td>${input.agentSummary.low}</td></tr>
          <tr><td>Secrets Detected</td><td>${input.agentSummary.secretsDetected}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>CSPM Findings</h2>
      <table>
        <thead>
          <tr><th>Severity</th><th>Open</th></tr>
        </thead>
        <tbody>
          <tr><td>Critical</td><td>${input.cspmSummary.critical}</td></tr>
          <tr><td>High</td><td>${input.cspmSummary.high}</td></tr>
          <tr><td>Medium</td><td>${input.cspmSummary.medium}</td></tr>
          <tr><td>Low</td><td>${input.cspmSummary.low}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Recent Violations</h2>
      <table>
        <thead>
          <tr><th>Severity</th><th>Summary</th><th>Date</th></tr>
        </thead>
        <tbody>
          ${violationRows || '<tr><td colspan="3">No violations found</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Recommendations</h2>
      <ul>
        ${input.score.agentScore < 70 ? '<li>Review critical agent activity events and restrict sensitive file access.</li>' : ''}
        ${input.score.cspmScore < 70 ? '<li>Address open critical and high CSPM findings immediately.</li>' : ''}
        ${input.agentSummary.secretsDetected > 0 ? '<li>Investigate secrets detected in agent sessions.</li>' : ''}
        <li>Enforce agent policies for file access patterns and command restrictions.</li>
        <li>Schedule regular CSPM scans to track cloud posture improvements.</li>
      </ul>
    </div>

    <footer>
      <p>Generated by OpenSyber - ${now}</p>
    </footer>
  </div>
</body>
</html>`;
}
