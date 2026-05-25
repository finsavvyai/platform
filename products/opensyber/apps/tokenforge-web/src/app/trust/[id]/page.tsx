'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Shield, CheckCircle, AlertTriangle, Users, Clock } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://tokenforge-api.opensyber.cloud';

interface TrustData {
  name: string;
  plan: string;
  totalVerifications: number;
  threatsBlocked: number;
  averageTrustScore: number;
  activeSessions: number;
  lastVerifiedAt: string | null;
}

function StatCard({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string | number;
}): React.ReactElement {
  return (
    <div className="gradient-border">
      <div className="rounded-2xl bg-panel p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface">
          <Icon className="h-5 w-5 text-info" />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-sm text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

export default function TrustPage(): React.ReactElement {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/public/trust/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void">
        <div className="text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-text-muted" />
          <h1 className="text-xl font-bold">Trust page not found</h1>
          <p className="mt-2 text-sm text-text-secondary">
            This organization has not enabled their public trust page.
          </p>
        </div>
      </div>
    );
  }

  const lastVerified = data.lastVerifiedAt
    ? new Date(data.lastVerifiedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';

  return (
    <div className="min-h-screen bg-void">
      <div className="border-b border-ok/20 bg-ok/5 px-4 py-3 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-ok">
          <Shield className="h-4 w-4" /> Protected by TokenForge
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <Shield className="h-8 w-8 text-info" />
          </div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="mt-2 text-sm text-text-secondary">Session security powered by device-bound ECDSA P-256 keys</p>
          <span className="mt-3 inline-block rounded-full bg-info/10 px-3 py-1 text-xs font-medium text-info">
            {data.plan.charAt(0).toUpperCase() + data.plan.slice(1)} Plan
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={CheckCircle} label="Total Verifications" value={data.totalVerifications.toLocaleString()} />
          <StatCard icon={AlertTriangle} label="Threats Blocked" value={data.threatsBlocked.toLocaleString()} />
          <StatCard icon={Shield} label="Average Trust Score" value={`${data.averageTrustScore}/100`} />
          <StatCard icon={Users} label="Active Sessions" value={data.activeSessions.toLocaleString()} />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-text-muted">
          <Clock className="h-4 w-4" /> Last verified: {lastVerified}
        </div>
        <div className="mt-16 text-center">
          <a href="https://tokenforge.opensyber.cloud" target="_blank" rel="noopener noreferrer" className="text-sm text-text-muted hover:text-text-secondary transition">
            Powered by TokenForge
          </a>
        </div>
      </div>
    </div>
  );
}
