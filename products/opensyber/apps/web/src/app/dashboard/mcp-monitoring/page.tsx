import { Cpu, Server, ArrowRight, BookOpen } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export const metadata = { title: 'MCP Monitoring' };

interface MCPServer {
  id: string;
  name: string;
  uri: string;
  toolsCount: number;
  status: string;
  lastSeen: string;
}

async function fetchMCPServers(): Promise<MCPServer[]> {
  try {
    const token = await getApiToken();
    if (!token) return [];
    const res = await apiClient<{ instances: Array<{ id: string }> }>(
      '/api/instances',
      { token },
    );
    const instance = res.instances[0];
    if (!instance) return [];
    const data = await apiClient<{ servers: MCPServer[] }>(
      `/api/instances/${instance.id}/mcp-servers`,
      { token },
    );
    return data.servers ?? [];
  } catch {
    return [];
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface border border-wire mb-6">
        <Server className="h-7 w-7 text-text-secondary" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">
        No MCP Servers Connected
      </h2>
      <p className="text-sm text-text-secondary max-w-md mb-2">
        MCP (Model Context Protocol) servers extend your agent with external
        tools and data sources. Once your agent connects to MCP servers, their
        status and activity will appear here.
      </p>
      <p className="text-sm text-text-secondary max-w-md mb-8">
        MCP monitoring data will appear once your agent connects to MCP servers.
      </p>
      <div className="flex gap-3">
        <Link
          href="/docs/agent"
          className="flex items-center gap-2 rounded-lg border border-wire bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-[#1a2433] transition"
        >
          <BookOpen className="h-4 w-4" />
          Read the Docs
        </Link>
        <Link
          href="/dashboard/getting-started"
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-[#00c9ab] transition"
        >
          Getting Started
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function ServerTable({ servers }: { servers: MCPServer[] }) {
  return (
    <div className="rounded border border-border bg-panel/30 overflow-hidden">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="px-6 py-3 font-medium">Name</th>
            <th className="px-6 py-3 font-medium">URI</th>
            <th className="px-6 py-3 font-medium text-center">Tools</th>
            <th className="px-6 py-3 font-medium text-center">Status</th>
            <th className="px-6 py-3 font-medium text-right">Last Seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/50">
          {servers.map((s) => (
            <tr key={s.id} className="hover:bg-surface/30 transition">
              <td className="px-6 py-3 font-medium text-white">{s.name}</td>
              <td className="px-6 py-3 text-text-secondary font-mono text-xs">
                {s.uri}
              </td>
              <td className="px-6 py-3 text-center text-text-primary">
                {s.toolsCount}
              </td>
              <td className="px-6 py-3 text-center">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    s.status === 'connected'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-surface text-text-secondary'
                  }`}
                >
                  {s.status}
                </span>
              </td>
              <td className="px-6 py-3 text-right text-text-dim text-xs">
                {new Date(s.lastSeen).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

export default async function MCPMonitoringPage() {
  const servers = await fetchMCPServers();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Cpu className="h-6 w-6 text-cyan-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            MCP Server Monitoring
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Monitor connected MCP servers and their activity
          </p>
        </div>
      </div>

      {servers.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-wire bg-surface p-4">
              <p className="text-sm text-text-secondary">Connected Servers</p>
              <p className="text-2xl font-bold text-white mt-2">
                {servers.length}
              </p>
            </div>
            <div className="rounded-lg border border-wire bg-surface p-4">
              <p className="text-sm text-text-secondary">Total Tools</p>
              <p className="text-2xl font-bold text-white mt-2">
                {servers.reduce((sum, s) => sum + s.toolsCount, 0)}
              </p>
            </div>
          </div>
          <ServerTable servers={servers} />
        </>
      )}
    </div>
  );
}
