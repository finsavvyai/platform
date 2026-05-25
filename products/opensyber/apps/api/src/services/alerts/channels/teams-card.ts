/**
 * Microsoft Teams Adaptive Card builder for alert notifications.
 */

import type { AlertMessage } from '../types.js';
import { getSeverityEmoji } from '../types.js';

/**
 * Escape special characters for Markdown
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[*_\[\]~`#]/g, '\\$&');
}

/**
 * Build Teams Adaptive Card payload for alert
 */
export function buildTeamsPayload(message: AlertMessage): string {
  const severityEmoji = getSeverityEmoji(message.severity);

  const facts = [
    { title: 'Severity', value: `${severityEmoji} ${message.severity.toUpperCase()}` },
    { title: 'Organization', value: message.organization || 'OpenSyber' },
    { title: 'Account', value: message.account || 'N/A' },
    { title: 'Time', value: new Date(message.timestamp).toLocaleString() },
    { title: 'Findings Count', value: message.findings.length.toString() },
  ];

  const findingsItems = message.findings.slice(0, 5).map((f) => ({
    type: 'TextBlock',
    text: `${getSeverityEmoji(f.severity)} **${escapeMarkdown(f.title)}**\n${f.resourceType}: ${escapeMarkdown(f.resourceId)}`,
    wrap: true,
  }));

  if (message.findings.length > 5) {
    findingsItems.push({
      type: 'TextBlock',
      text: `... and ${message.findings.length - 5} more findings`,
      wrap: true,
    } as any);
  }

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          type: 'AdaptiveCard',
          schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'ColumnSet',
                  columns: [
                    {
                      type: 'Column', width: 'auto',
                      items: [{ type: 'TextBlock', text: severityEmoji, size: 'large' }],
                    },
                    {
                      type: 'Column', width: 'stretch',
                      items: [
                        { type: 'TextBlock', text: 'Security Alert', weight: 'bolder', size: 'medium' },
                        { type: 'TextBlock', text: message.organization || 'OpenSyber', isSubtle: true, spacing: 'none' },
                      ],
                    },
                  ],
                },
              ],
            },
            { type: 'TextBlock', text: `**${escapeMarkdown(message.title)}**`, size: 'large', weight: 'bolder', spacing: 'medium' },
            { type: 'TextBlock', text: message.description, wrap: true, spacing: 'default' },
            { type: 'FactSet', facts, spacing: 'default' },
            ...(message.findings.length > 0
              ? [
                  { type: 'TextBlock', text: `**Affected Resources** (${message.findings.length})`, weight: 'bolder', spacing: 'medium' },
                  { type: 'Container', items: findingsItems, style: 'default', spacing: 'small' },
                ]
              : []),
          ],
          ...(message.dashboardUrl
            ? { actions: [{ type: 'Action.OpenUrl', title: 'View in Dashboard', url: message.dashboardUrl, style: 'positive' }] }
            : {}),
        },
      },
    ],
  };

  return JSON.stringify(card);
}
