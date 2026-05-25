/** clawpipe_report_to_notion — append a page to a Notion database.
 *
 * Env: NOTION_TOKEN (https://www.notion.so/my-integrations)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const Input = z.object({
  database_id: z.string().min(1),
  title: z.string().min(1).max(200),
  body_markdown: z.string().max(16_000).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const NOTION_VERSION = '2022-06-28';

export function registerNotionTool(server: McpServer): void {
  server.tool(
    'clawpipe_report_to_notion',
    'Append a page to a Notion database. Use for cost digests, weekly summaries, incident logs.',
    Input.shape,
    async (args) => {
      const token = process.env.NOTION_TOKEN;
      if (!token) return { content: [{ type: 'text', text: 'NOTION_TOKEN not set' }], isError: true };
      const paragraphs = (args.body_markdown ?? '').split(/\n{2,}/).filter(Boolean).slice(0, 50);
      const children = paragraphs.map((p) => ({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: p.slice(0, 2000) } }] },
      }));
      const props: Record<string, unknown> = {
        Name: { title: [{ text: { content: args.title } }] },
        ...(args.properties ?? {}),
      };
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION,
        },
        body: JSON.stringify({
          parent: { database_id: args.database_id },
          properties: props,
          children,
        }),
      });
      const body = await res.text();
      if (!res.ok) return { content: [{ type: 'text', text: `Notion ${res.status}: ${body.slice(0, 500)}` }], isError: true };
      const parsed = JSON.parse(body) as { url?: string; id?: string };
      return { content: [{ type: 'text', text: `Created ${parsed.id}: ${parsed.url}` }] };
    },
  );
}
