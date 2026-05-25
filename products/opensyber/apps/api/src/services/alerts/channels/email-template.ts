/**
 * Email HTML and plain text template builders for alert emails.
 */

import type { AlertMessage, AlertFinding } from '../types.js';
import { getSeverityColor, getSeverityEmoji } from '../types.js';

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (c: string) => map[c] ?? c);
}

/**
 * HTML template for email alerts
 */
export function buildEmailHtml(message: AlertMessage): string {
  const severityColor = getSeverityColor(message.severity);
  const severityEmoji = getSeverityEmoji(message.severity);

  const findingsRows = message.findings
    .map((f: AlertFinding) => {
      const fEmoji = getSeverityEmoji(f.severity);
      const fColor = getSeverityColor(f.severity);
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; text-align: center;">${fEmoji}</td>
          <td style="padding: 12px;">
            <div style="font-weight: 600; color: #1f2937;">${escapeHtml(f.title)}</div>
            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
              ${escapeHtml(f.resourceType)} • ${escapeHtml(f.resourceId)}
            </div>
          </td>
          <td style="padding: 12px;">
            <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background-color: ${fColor}20; color: ${fColor}; font-size: 12px; font-weight: 500;">
              ${f.severity.toUpperCase()}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const dashboardLink = message.dashboardUrl
    ? `<a href="${escapeHtml(message.dashboardUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View in Dashboard</a>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Security Alert: ${escapeHtml(message.title)}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <!-- Header -->
            <div style="padding: 24px; background-color: ${severityColor}20; border-bottom: 1px solid ${severityColor}40;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 32px;">${severityEmoji}</span>
                <div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937;">
                    Security Alert
                  </h1>
                  <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">
                    ${escapeHtml(message.organization || 'OpenSyber')} • ${new Date(message.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <!-- Alert Summary -->
            <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">
                ${escapeHtml(message.title)}
              </h2>
              <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
                ${escapeHtml(message.description)}
              </p>
            </div>

            <!-- Findings Table -->
            ${message.findings.length > 0 ? `
            <div style="padding: 24px;">
              <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
                Affected Resources (${message.findings.length})
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280;">Severity</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280;">Finding</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280;">Level</th>
                  </tr>
                </thead>
                <tbody>
                  ${findingsRows}
                </tbody>
              </table>
            </div>
            ` : ''}

            <!-- CTA -->
            <div style="padding: 24px; background-color: #f9fafb; text-align: center;">
              ${dashboardLink}
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
            <p style="margin: 0;">This alert was sent by OpenSyber Security Platform.</p>
            <p style="margin: 4px 0 0 0;">
              <a href="${(globalThis as typeof globalThis & { APP_URL?: string }).APP_URL ?? 'https://opensyber.cloud'}/settings/notifications" style="color: #9ca3af; text-decoration: underline;">Manage notification preferences</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Plain text version of email alert
 */
export function buildEmailText(message: AlertMessage): string {
  const lines = [
    'Security Alert',
    '===',
    '',
    `Severity: ${message.severity.toUpperCase()}`,
    `Organization: ${message.organization || 'OpenSyber'}`,
    `Time: ${new Date(message.timestamp).toLocaleString()}`,
    '',
    message.title,
    '',
    message.description,
    '',
  ];

  if (message.findings.length > 0) {
    lines.push(`Affected Resources (${message.findings.length}):`);
    lines.push('');
    message.findings.forEach((f: AlertFinding, i: number) => {
      lines.push(`${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
      lines.push(`   Resource: ${f.resourceType} / ${f.resourceId}`);
      lines.push(`   ${f.remediation}`);
      lines.push('');
    });
  }

  if (message.dashboardUrl) {
    lines.push(`View details: ${message.dashboardUrl}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('OpenSyber Security Platform');
  const appUrl = (globalThis as typeof globalThis & { APP_URL?: string }).APP_URL ?? 'https://opensyber.cloud';
  lines.push(`Manage notifications: ${appUrl}/settings/notifications`);

  return lines.join('\n');
}
