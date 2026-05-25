/** clawpipe_report_to_jira — create a Jira issue for budget/cost anomalies.
 *
 * Env: JIRA_BASE_URL (https://acme.atlassian.net), JIRA_EMAIL, JIRA_TOKEN
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const Input = z.object({
  summary: z.string().min(1).max(255),
  description: z.string().max(32_000),
  project_key: z.string().min(1),
  issue_type: z.string().default('Task'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export function registerJiraTool(server: McpServer): void {
  server.tool(
    'clawpipe_report_to_jira',
    'Create a Jira issue. Use for budget breaches, cost spikes, or agent anomalies.',
    Input.shape,
    async (args) => {
      const base = process.env.JIRA_BASE_URL;
      const email = process.env.JIRA_EMAIL;
      const token = process.env.JIRA_TOKEN;
      if (!base || !email || !token) {
        return { content: [{ type: 'text', text: 'JIRA_BASE_URL/JIRA_EMAIL/JIRA_TOKEN not set' }], isError: true };
      }
      const auth = Buffer.from(`${email}:${token}`).toString('base64');
      const res = await fetch(`${base.replace(/\/$/, '')}/rest/api/3/issue`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            project: { key: args.project_key },
            summary: `[${args.severity.toUpperCase()}] ${args.summary}`,
            description: {
              type: 'doc', version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: args.description }] }],
            },
            issuetype: { name: args.issue_type },
            labels: ['clawpipe', `severity-${args.severity}`],
          },
        }),
      });
      const body = await res.text();
      if (!res.ok) return { content: [{ type: 'text', text: `Jira ${res.status}: ${body.slice(0, 500)}` }], isError: true };
      const parsed = JSON.parse(body) as { key?: string; self?: string };
      return { content: [{ type: 'text', text: `Created ${parsed.key}: ${parsed.self}` }] };
    },
  );
}
