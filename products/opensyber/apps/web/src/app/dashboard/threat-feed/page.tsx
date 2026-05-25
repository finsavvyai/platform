import Link from 'next/link';
import { Radar, AlertTriangle, Package, Clock, ExternalLink } from 'lucide-react';

export const metadata = { title: 'Threat Feed' };

interface ThreatEntry {
  id: string;
  title: string;
  source: string;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  description: string;
  date: string;
  cve?: string;
}

const recentThreats: ThreatEntry[] = [
  {
    id: 'th1',
    title: 'UNC6426 Supply Chain Attack via npm',
    source: 'Mandiant / Socket.dev',
    severity: 'critical',
    category: 'Supply Chain',
    description: 'North Korean threat actor UNC6426 published trojanized npm packages targeting crypto and CI/CD pipelines.',
    date: '2026-03-18',
  },
  {
    id: 'th2',
    title: 'Trivy Container Scanner Compromise',
    source: 'Aqua Security Advisory',
    severity: 'critical',
    category: 'Container Security',
    description: 'Malicious update to Trivy scanner exfiltrated container image metadata and cloud credentials.',
    date: '2026-03-15',
  },
  {
    id: 'th3',
    title: 'CVE-2026-33017 — Langflow RCE',
    source: 'NVD / CISA KEV',
    severity: 'critical',
    category: 'AI Framework',
    description: 'Remote code execution in Langflow allowing unauthenticated attackers to run arbitrary code via crafted flow definitions.',
    date: '2026-03-12',
    cve: 'CVE-2026-33017',
  },
  {
    id: 'th4',
    title: 'CursorJack — IDE Extension Hijack',
    source: 'Trail of Bits',
    severity: 'high',
    category: 'IDE Security',
    description: 'Malicious VS Code / Cursor extension intercepted AI-generated code suggestions, injecting backdoors into generated output.',
    date: '2026-03-10',
  },
  {
    id: 'th5',
    title: 'MCP Server Prompt Injection Campaign',
    source: 'OpenSyber Research',
    severity: 'high',
    category: 'AI Agent',
    description: 'Coordinated prompt injection attacks targeting MCP tool servers to exfiltrate API keys from agent runtime contexts.',
    date: '2026-03-08',
  },
];

const severityStyles = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
};

export default async function ThreatFeedPage() {
  const criticalCount = recentThreats.filter((t) => t.severity === 'critical').length;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Radar className="h-6 w-6 text-pink-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Threat Intelligence Feed</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time threats affecting AI agents, supply chains, and cloud infrastructure
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Tracked Threats (30d)</p>
          <p className="text-2xl font-bold text-white mt-2">{recentThreats.length}</p>
        </div>
        <div className="bg-gray-800/50 border border-red-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-400">Critical Severity</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{criticalCount}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Categories Monitored</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">
            {new Set(recentThreats.map((t) => t.category)).size}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Recent Threat Intelligence
        </h2>
        <div className="space-y-3">
          {recentThreats.map((threat) => (
            <div key={threat.id} className={`rounded-lg p-4 ${severityStyles[threat.severity]}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{threat.title}</h3>
                  <p className="text-sm mt-2">{threat.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs opacity-75">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {threat.date}
                    </span>
                    <span>Source: {threat.source}</span>
                    <span className="bg-black/20 px-2 py-0.5 rounded">{threat.category}</span>
                    {threat.cve && (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <ExternalLink className="h-3 w-3" /> {threat.cve}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-black/30 rounded ml-4">
                  {threat.severity.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
          <Package className="h-4 w-4 text-signal" />
          Connect Your Stack for Live Monitoring
        </h3>
        <p className="text-sm text-gray-300">
          Connect your cloud accounts, CI/CD pipelines, and agent runtimes to receive
          personalized threat intelligence. OpenSyber correlates threats against your
          actual dependencies and infrastructure in real time.
        </p>
        <Link href="/dashboard/integrations" className="inline-flex items-center gap-1 mt-3 text-sm text-signal hover:text-signal-hover">
          Set up integrations <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
