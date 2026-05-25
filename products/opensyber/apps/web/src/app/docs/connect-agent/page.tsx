import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClientTable,
  CodeBlock,
  Step,
  Troubleshooting,
} from './components';

export const metadata: Metadata = {
  title: 'Connect your agent — OpenSyber Docs',
  description:
    'Install a local client — CLI, MCP Server, or VS Code extension — and start streaming events to your OpenSyber agent in under 30 seconds.',
  openGraph: {
    title: 'Connect your agent — OpenSyber Docs',
    description:
      'Install a local client and start streaming events to your OpenSyber agent in under 30 seconds.',
    type: 'article',
  },
};

export default function ConnectAgentPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide tracking-tight">
        Connect your agent
      </h1>
      <p className="text-lg text-text-secondary mt-2">
        Your agent is deployed, but it has nothing to watch yet. To start sending
        events you need to install one client on your local machine and point it
        at your instance. Most users see their first event within 30 seconds of
        running the login command.
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">1. Choose your client</h2>
      <p className="text-text-secondary">
        Pick one. You do not need all three — each sends the same events through
        the same gateway. If you are unsure, start with the CLI.
      </p>
      <ClientTable />

      <h2 className="text-2xl font-semibold mt-10">2. CLI install</h2>
      <p className="text-text-secondary">
        The <code className="bg-surface px-1.5 py-0.5 rounded text-sm">@opensyber/cli</code>{' '}
        client is the fastest path. Node.js 18+ required.
      </p>
      <Step n={1} title="Install the CLI globally">
        <CodeBlock>{`npm install -g @opensyber/cli`}</CodeBlock>
      </Step>
      <Step n={2} title="Get your gateway token">
        Open the dashboard, click your instance, and copy the token from the
        Connect panel. Treat it like a password.
      </Step>
      <Step n={3} title="Log in from your terminal">
        <CodeBlock>{`opensyber login --token <your-gateway-token>`}</CodeBlock>
      </Step>
      <Step n={4} title="Verify the connection">
        <CodeBlock>{`opensyber status`}</CodeBlock>
        You should see <code className="bg-surface px-1.5 py-0.5 rounded text-sm">connected</code>{' '}
        and your instance ID. Events start flowing immediately.
      </Step>

      <h2 className="text-2xl font-semibold mt-10">3. MCP Server install</h2>
      <p className="text-text-secondary">
        Use{' '}
        <code className="bg-surface px-1.5 py-0.5 rounded text-sm">@opensyber/mcp</code>{' '}
        to stream events from Claude Desktop, Cursor, or any MCP-compatible client.
      </p>
      <Step n={1} title="Install the MCP server">
        <CodeBlock>{`npm install -g @opensyber/mcp`}</CodeBlock>
      </Step>
      <Step n={2} title="Add it to your Claude Desktop config">
        Edit{' '}
        <code className="bg-surface px-1.5 py-0.5 rounded text-sm">
          ~/Library/Application Support/Claude/claude_desktop_config.json
        </code>{' '}
        (macOS) or{' '}
        <code className="bg-surface px-1.5 py-0.5 rounded text-sm">
          %APPDATA%\Claude\claude_desktop_config.json
        </code>{' '}
        (Windows):
        <CodeBlock>{`{
  "mcpServers": {
    "opensyber": {
      "command": "npx",
      "args": ["-y", "@opensyber/mcp"],
      "env": {
        "OPENSYBER_TOKEN": "<your-gateway-token>"
      }
    }
  }
}`}</CodeBlock>
      </Step>
      <Step n={3} title="Restart Claude Desktop">
        Fully quit and reopen. The MCP server auto-starts and authenticates on
        the first tool call.
      </Step>
      <Step n={4} title="Verify the connection">
        Ask Claude:{' '}
        <em className="text-white">&quot;List my OpenSyber instances.&quot;</em>{' '}
        If you see your instance ID, you are connected.
      </Step>

      <h2 className="text-2xl font-semibold mt-10">4. VS Code extension install</h2>
      <p className="text-text-secondary">
        The extension surfaces events inline in the editor and runs entirely in
        the background. No terminal required.
      </p>
      <Step n={1} title="Install the extension">
        Open the Extensions panel (⇧⌘X) and search for{' '}
        <strong className="text-white">OpenSyber Connect</strong>. Click Install.
      </Step>
      <Step n={2} title="Open the command palette">
        Press ⇧⌘P (macOS) or Ctrl+Shift+P (Windows/Linux) and run{' '}
        <code className="bg-surface px-1.5 py-0.5 rounded text-sm">
          OpenSyber: Connect Instance
        </code>
        .
      </Step>
      <Step n={3} title="Paste your gateway token">
        Copy the token from the dashboard Connect panel and paste it into the
        prompt. The extension stores it in the OS keychain.
      </Step>
      <Step n={4} title="Verify the connection">
        The status bar shows{' '}
        <code className="bg-surface px-1.5 py-0.5 rounded text-sm">
          OpenSyber: connected
        </code>{' '}
        with your instance ID. Click it to open the live event feed.
      </Step>

      <h2 className="text-2xl font-semibold mt-10">5. Verify the connection</h2>
      <p className="text-text-secondary">
        Open the dashboard and navigate to{' '}
        <Link href="/dashboard" className="text-signal underline">
          your instance
        </Link>
        . The Live Events panel should show events within 30 seconds of login.
        If the counter stays at zero for more than a minute, trigger something
        manually from your client to force a heartbeat:
      </p>
      <CodeBlock>{`opensyber ping`}</CodeBlock>
      <p className="text-text-secondary mt-3">
        You can also confirm via the API:
      </p>
      <CodeBlock>{`curl -H "Authorization: Bearer <your-gateway-token>" \\
  https://gateway.opensyber.cloud/v1/events?limit=5`}</CodeBlock>

      <h2 className="text-2xl font-semibold mt-10">6. Troubleshooting</h2>
      <p className="text-text-secondary">
        Five things go wrong. They all have the same five fixes.
      </p>
      <Troubleshooting />

      <div className="mt-10 rounded border border-signal/30 bg-signal/5 p-6">
        <h3 className="text-lg font-semibold text-signal">Still stuck?</h3>
        <p className="text-sm text-text-secondary mt-1">
          Head back to{' '}
          <Link href="/dashboard" className="text-signal underline">
            your dashboard
          </Link>{' '}
          and open the Connect panel — it shows your live token, instance ID,
          and the latest heartbeat timestamp.
        </p>
      </div>
    </article>
  );
}
