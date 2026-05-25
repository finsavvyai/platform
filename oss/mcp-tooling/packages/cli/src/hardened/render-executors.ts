/**
 * Render the hardened executors file. Each executor enforces:
 *   - egress allowlist (manifest-declared hosts only)
 *   - explicit method/path from the OpenAPI operation
 */

import type { ParsedEndpoint } from '../parser.js'

export function renderHardenedExecutors(endpoints: ParsedEndpoint[]): string {
  const bodies = endpoints.map(renderOne).join('\n\n')
  const mapping = endpoints
    .map(ep => `  ${JSON.stringify(ep.operationId)}: execute_${sanitize(ep.operationId)},`)
    .join('\n')

  return `/**
 * Tool executors — egress-restricted to manifest.egress hosts.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "..", "mcp-manifest.json"), "utf-8")) as { egress: string[] };
const ALLOWED: ReadonlySet<string> = new Set(manifest.egress);

function assertEgress(targetUrl: string): void {
  let host: string;
  try { host = new URL(targetUrl).hostname; } catch { throw new Error("Invalid URL: " + targetUrl); }
  if (!ALLOWED.has(host)) {
    throw new Error(\`[hardened] egress denied: \${host} (allowed: \${[...ALLOWED].join(", ") || "none"})\`);
  }
}

async function call(method: string, url: string, body?: unknown): Promise<unknown> {
  assertEgress(url);
  const apiKey = process.env.API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = \`Bearer \${apiKey}\`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(\`API error: \${res.status} \${res.statusText}\`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

${bodies}

export const executors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
${mapping}
};
`
}

function renderOne(ep: ParsedEndpoint): string {
  const funcName = sanitize(ep.operationId)
  const pathTemplate = ep.parameters
    .filter(p => p.in === 'path')
    .reduce(
      (acc, p) => acc.replace(`{${p.name}}`, `\${encodeURIComponent(String(args.${p.name}))}`),
      ep.path
    )
  const queryParams = ep.parameters.filter(p => p.in === 'query')
  const hasBody = Boolean(ep.requestBody?.content?.['application/json'])
  const baseDecl = `const base = (process.env.API_BASE_URL ?? "https://" + [...ALLOWED][0]).replace(/\\/$/, "");`
  const urlDecl = `const url = new URL(\`\${base}${pathTemplate}\`);`
  const queryAttach = queryParams.length
    ? queryParams
        .map(
          p =>
            `  if (args.${p.name} !== undefined) url.searchParams.set(${JSON.stringify(p.name)}, String(args.${p.name}));`
        )
        .join('\n')
    : ''
  const bodyArg = hasBody ? `, args.body` : ''

  return `async function execute_${funcName}(args: Record<string, unknown>): Promise<unknown> {
  ${baseDecl}
  ${urlDecl}
${queryAttach}
  return call(${JSON.stringify(ep.method)}, url.toString()${bodyArg});
}`
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}
