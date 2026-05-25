'use client';

import { useState } from 'react';
import { Network, Crown, Shield, AlertTriangle } from 'lucide-react';
import { BlastRadiusGraph } from '@/components/dashboard/attack-graph/BlastRadiusGraph';
import { BlastRadiusSummary } from '@/components/dashboard/attack-graph/BlastRadiusSummary';
import { CrownJewelPaths } from '@/components/dashboard/attack-graph/CrownJewelPaths';
import type { BlastRadiusData } from './types';

interface Props {
  sessions: { id: string; name: string; assetType: string; sensitivity: string; isCrownJewel: boolean }[];
  crownJewels: { id: string; name: string; assetType: string; sensitivity: string; isCrownJewel: boolean }[];
}

export function AttackPathsClient({ sessions, crownJewels }: Props) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [blastData, setBlastData] = useState<BlastRadiusData | null>(null);
  const [loading, setLoading] = useState(false);

  async function queryBlastRadius(sessionId: string) {
    setSelectedSession(sessionId);
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/attack-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryAssetId: sessionId, maxDepth: 10, minConfidence: 0.3 }),
      });
      const json = await res.json();
      setBlastData(json.data ?? null);
    } catch {
      setBlastData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Attack Paths</h1>
        <p className="mt-2 text-text-secondary">
          Visualize the blast radius of AI agent sessions — see what an attacker could reach.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Network} label="Agent Sessions" value={sessions.length} color="blue" />
        <StatCard icon={Crown} label="Crown Jewels" value={crownJewels.length} color="amber" />
        <StatCard
          icon={blastData ? AlertTriangle : Shield}
          label="Blast Radius"
          value={blastData?.blastRadius.score ?? '—'}
          color={blastData && blastData.blastRadius.score > 70 ? 'red' : 'green'}
        />
      </div>

      {/* Session Selector */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h2 className="text-lg font-medium mb-4">Select Agent Session</h2>
        {sessions.length === 0 ? (
          <p className="text-text-dim text-sm">No agent sessions discovered yet. Sync agent activity to see attack paths.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => queryBlastRadius(s.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedSession === s.id
                    ? 'border-info bg-signal/10'
                    : 'border-border bg-panel/50 hover:border-neutral-600'
                }`}
              >
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-text-dim mt-1">{s.id.slice(0, 16)}...</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Blast Radius Results */}
      {loading && (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <div className="animate-pulse text-text-secondary">Computing blast radius...</div>
        </div>
      )}

      {blastData && !loading && (
        <>
          <BlastRadiusSummary data={blastData.blastRadius} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BlastRadiusGraph assets={blastData.reachableAssets} entryId={blastData.entryAssetId} />
            </div>
            <div>
              <CrownJewelPaths paths={blastData.crownJewelPaths} total={blastData.totalCrownJewels} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Network; label: string; value: number | string; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-signal', amber: 'text-amber-500', red: 'text-red-500', green: 'text-green-500',
  };
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${colorMap[color] ?? 'text-text-secondary'}`} />
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
