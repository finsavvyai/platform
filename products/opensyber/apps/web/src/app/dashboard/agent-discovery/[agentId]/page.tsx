'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AgentDetail {
  id: string;
  name: string;
  framework: string;
  runtime: string;
  status: string;
  risk: { score: number; severity: string } | null;
  factors: string[];
}

export default function AgentDiscoveryDetailPage(): React.ReactElement {
  const params = useParams<{ agentId: string }>();
  const [detail, setDetail] = useState<AgentDetail | null>(null);

  useEffect(() => {
    if (!params?.agentId) return;
    fetch(`/api/proxy/discovery/agents/${params.agentId}`)
      .then((response) => response.json())
      .then((body: { data?: AgentDetail }) => setDetail(body.data ?? null))
      .catch(() => setDetail(null));
  }, [params?.agentId]);

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/agent-discovery" className="text-sm text-signal underline">Back to discovery</Link>
        <div className="rounded-lg border border-wire bg-surface p-6 text-sm text-text-secondary">
          Loading agent detail...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/agent-discovery" className="text-sm text-signal underline">Back to discovery</Link>
      <div>
        <h1 className="text-3xl font-bold">{detail.name}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {detail.framework} • {detail.runtime} • {detail.status}
        </p>
      </div>
      <div className="rounded-lg border border-wire bg-surface p-4">
        <p className="text-sm font-medium">Risk</p>
        <p className="mt-1 text-sm text-text-secondary">
          {detail.risk ? `${detail.risk.severity} (${detail.risk.score})` : 'No risk score yet'}
        </p>
      </div>
      <div className="rounded-lg border border-wire bg-surface p-4">
        <p className="text-sm font-medium">Risk factors</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          {detail.factors.length > 0 ? detail.factors.map((factor) => (
            <li key={factor}>{factor}</li>
          )) : <li>No factors available for this agent.</li>}
        </ul>
      </div>
    </div>
  );
}
