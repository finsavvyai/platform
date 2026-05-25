'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2, Plug, Send, Terminal, Code2, Boxes, Sparkles, Wind, Bot } from 'lucide-react';

interface Props {
  instanceId: string;
  gatewayToken: string | null;
  hasEvents: boolean;
}

type TabKey = 'cli' | 'mcp' | 'vscode' | 'cursor' | 'windsurf' | 'claude-code';

const TABS: { key: TabKey; label: string; icon: typeof Terminal }[] = [
  { key: 'cli', label: 'CLI', icon: Terminal },
  { key: 'mcp', label: 'MCP Server', icon: Boxes },
  { key: 'vscode', label: 'VS Code', icon: Code2 },
  { key: 'cursor', label: 'Cursor', icon: Sparkles },
  { key: 'windsurf', label: 'Windsurf', icon: Wind },
  { key: 'claude-code', label: 'Claude Code', icon: Bot },
];

function maskToken(token: string | null): string {
  if (!token) return '••••••••••••••••';
  return `${token.slice(0, 4)}${'•'.repeat(Math.max(token.length - 4, 12))}`;
}

function mcpConfig(token: string, command = 'npx', args: string[] = ['-y', '@opensyber/mcp']): string {
  return `{
  "mcpServers": {
    "opensyber": {
      "command": "${command}",
      "args": ${JSON.stringify(args)},
      "env": { "OPENSYBER_TOKEN": "${token}" }
    }
  }
}`;
}

interface BlockProps {
  id: string;
  label: string;
  value: string;
  copiedId: string | null;
  onCopy: (id: string, value: string) => void;
  multiline?: boolean;
}

function CodeBlock({ id, label, value, copiedId, onCopy, multiline }: BlockProps) {
  const copied = copiedId === id;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-text-dim">{label}</p>
        <button onClick={() => onCopy(id, value)} aria-label={`Copy ${label}`} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition">
          {copied ? <><Check className="h-3 w-3 text-green-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <pre className={`rounded-lg bg-surface/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-text-primary ${multiline ? 'whitespace-pre overflow-x-auto' : 'break-all whitespace-pre-wrap'}`}>{value}</pre>
    </div>
  );
}

export function ConnectAgentCard({ instanceId, gatewayToken, hasEvents }: Props) {
  const [tab, setTab] = useState<TabKey>('cli');
  const [revealed, setRevealed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);

  const tokenDisplay = revealed && gatewayToken ? gatewayToken : maskToken(gatewayToken);
  const tokenForCommands = gatewayToken ?? '<your-token>';

  async function handleCopy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch { /* clipboard may not be available */ }
  }

  async function handleSendTestEvent() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/proxy/instances/${instanceId}/events/test`, { method: 'POST' });
      if (!res.ok) { setSendError('Failed to send test event. Try again.'); return; }
      setSentAt(Date.now());
      setCountdown(10);
      const iv = setInterval(() => {
        setCountdown((c) => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
      }, 1000);
    } catch {
      setSendError('Network error. Check your connection.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
          <Plug className="h-4 w-4 text-signal" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Connect your device</h3>
          <p className="text-sm text-text-secondary">Link your machine to start streaming events.</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">Gateway token</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setRevealed((r) => !r)} disabled={!gatewayToken} aria-label={revealed ? 'Hide token' : 'Reveal token'} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition disabled:opacity-40">
              {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <button onClick={() => gatewayToken && handleCopy('token', gatewayToken)} disabled={!gatewayToken} aria-label="Copy token" className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition disabled:opacity-40">
              {copiedId === 'token' ? <><Check className="h-3 w-3 text-green-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>
        </div>
        <div className="rounded-lg bg-surface/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-text-primary break-all">{tokenDisplay}</div>
      </div>

      <div role="tablist" className="mb-3 flex flex-wrap gap-1 rounded-lg border border-border bg-surface/40 p-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button key={key} role="tab" aria-selected={active} onClick={() => setTab(key)} className={`flex flex-1 min-w-[96px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${active ? 'bg-signal text-black' : 'text-text-secondary hover:text-text-primary'}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {tab === 'cli' && (<>
          <CodeBlock id="cli-install" label="1. Install the CLI" value="npm install -g @opensyber/cli" copiedId={copiedId} onCopy={handleCopy} />
          <CodeBlock id="cli-login" label="2. Authenticate" value={`opensyber login ${tokenForCommands}`} copiedId={copiedId} onCopy={handleCopy} />
        </>)}
        {tab === 'mcp' && (
          <CodeBlock id="mcp-config" label="Claude Desktop · ~/Library/Application Support/Claude/claude_desktop_config.json" value={mcpConfig(tokenForCommands)} copiedId={copiedId} onCopy={handleCopy} multiline />
        )}
        {tab === 'vscode' && (<>
          <CodeBlock id="vscode-install" label="1. Install the extension" value="code --install-extension opensyber.opensyber" copiedId={copiedId} onCopy={handleCopy} />
          <CodeBlock id="vscode-token" label="2. Set your token (Command Palette → OpenSyber: Login)" value={tokenForCommands} copiedId={copiedId} onCopy={handleCopy} />
        </>)}
        {tab === 'cursor' && (
          <CodeBlock id="cursor-config" label="Cursor · ~/.cursor/mcp.json" value={mcpConfig(tokenForCommands)} copiedId={copiedId} onCopy={handleCopy} multiline />
        )}
        {tab === 'windsurf' && (
          <CodeBlock id="windsurf-config" label="Windsurf · ~/.codeium/windsurf/mcp_config.json" value={mcpConfig(tokenForCommands)} copiedId={copiedId} onCopy={handleCopy} multiline />
        )}
        {tab === 'claude-code' && (<>
          <CodeBlock id="cc-add" label="Register the MCP server with Claude Code" value={`claude mcp add opensyber -- npx -y @opensyber/mcp`} copiedId={copiedId} onCopy={handleCopy} />
          <CodeBlock id="cc-env" label="Export your token so the MCP server can read it" value={`export OPENSYBER_TOKEN=${tokenForCommands}`} copiedId={copiedId} onCopy={handleCopy} />
        </>)}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-surface/50 px-4 py-3">
        <div className="flex items-center gap-3">
          {hasEvents ? (<>
            <span className="flex h-2.5 w-2.5 rounded-full bg-green-400" aria-hidden />
            <p className="text-sm text-text-primary">Connected — events are flowing</p>
          </>) : sentAt ? (<>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-signal" />
            <p className="text-sm text-text-secondary">Event sent — check your feed{countdown > 0 ? ` (${countdown}s)` : ''}</p>
          </>) : (<>
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <p className="text-sm text-text-secondary">Waiting for your first event from this device…</p>
          </>)}
        </div>
        {!hasEvents && (
          <button onClick={handleSendTestEvent} disabled={sending} className="flex items-center gap-1.5 rounded-md border border-wire px-3 py-1.5 text-xs text-text-primary hover:bg-surface transition disabled:opacity-50">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Send test event
          </button>
        )}
      </div>
      {sendError && <p className="mt-2 text-xs text-red-400">{sendError}</p>}
    </div>
  );
}
