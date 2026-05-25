import type { ReactNode } from 'react';

export function CodeBlock({ children }: { children: string }) {
  return (
    <div className="not-prose rounded bg-surface/50 border border-border/50 p-4 mt-3 overflow-x-auto">
      <code className="font-[family-name:var(--font-mono)] text-sm text-text-primary whitespace-pre">
        {children}
      </code>
    </div>
  );
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white">
        <span className="font-[family-name:var(--font-mono)] text-signal mr-2">
          {String(n).padStart(2, '0')}
        </span>
        {title}
      </h3>
      <div className="text-text-secondary mt-1">{children}</div>
    </div>
  );
}

interface ClientRow {
  client: string;
  install: string;
  bestFor: string;
}

const CLIENT_ROWS: ClientRow[] = [
  {
    client: 'CLI',
    install: '@opensyber/cli',
    bestFor: 'Terminal-heavy devs, CI pipelines, scripted workflows',
  },
  {
    client: 'MCP Server',
    install: '@opensyber/mcp',
    bestFor: 'Claude Desktop, Cursor, any MCP-compatible AI client',
  },
  {
    client: 'VS Code Extension',
    install: 'OpenSyber Connect',
    bestFor: 'Editor-native telemetry, inline event visibility',
  },
];

export function ClientTable() {
  return (
    <div className="not-prose overflow-hidden rounded border border-border mt-4">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full">
        <thead>
          <tr className="border-b border-border bg-panel/50">
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              Client
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              Install
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              Best for
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800 text-sm text-text-primary">
          {CLIENT_ROWS.map((row) => (
            <tr key={row.client}>
              <td className="px-4 py-3 font-medium">{row.client}</td>
              <td className="px-4 py-3">
                <code className="bg-surface px-1.5 py-0.5 rounded text-xs">
                  {row.install}
                </code>
              </td>
              <td className="px-4 py-3 text-text-secondary">{row.bestFor}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

interface TroubleshootItem {
  problem: string;
  fix: string;
}

const TROUBLESHOOT: TroubleshootItem[] = [
  {
    problem: 'No token found',
    fix: 'Open the dashboard, click your instance, and copy the Gateway Token from the Connect panel. Tokens rotate every 30 days — grab a fresh one if yours is older.',
  },
  {
    problem: '401 Unauthorized',
    fix: 'The token is expired, revoked, or belongs to a different instance. Re-run the login command with a fresh token from the dashboard.',
  },
  {
    problem: 'Network blocked (ECONNREFUSED / timeout)',
    fix: 'Your firewall is blocking outbound HTTPS to gateway.opensyber.cloud on port 443. Allowlist that host or switch networks.',
  },
  {
    problem: 'Events not appearing in the dashboard',
    fix: 'Run `opensyber status` to confirm the client is authenticated. Check that the instance ID in your local config matches the one shown in the dashboard URL.',
  },
  {
    problem: 'Wrong instance ID',
    fix: 'If you have multiple instances, the CLI defaults to the first one. Pass `--instance inst_abc123` explicitly or run `opensyber use inst_abc123` to set the default.',
  },
];

export function Troubleshooting() {
  return (
    <div className="mt-4 space-y-4">
      {TROUBLESHOOT.map((item) => (
        <div
          key={item.problem}
          className="rounded border border-border/50 bg-surface/30 p-4"
        >
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-signal">
            {item.problem}
          </p>
          <p className="text-sm text-text-secondary mt-2">{item.fix}</p>
        </div>
      ))}
    </div>
  );
}
