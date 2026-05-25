'use client';

import { useState, useEffect } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { getLevelColor } from './types';
import type { Factor, ThreatLevel, ThreatEvent } from './types';
import { ThreatGauge } from './ThreatGauge';
import { ThreatSparkline } from './ThreatTimeline';
import { fetchThreatLevel } from './fetch-threat';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-info/20 text-info',
};

const SCORE_BAR_COLORS: Record<string, string> = {
  'red-500': 'bg-red-500',
  'orange-500': 'bg-orange-500',
  'amber-500': 'bg-amber-500',
  'blue-500': 'bg-info',
  'green-500': 'bg-green-500',
};

function TrendIcon({ trend }: { trend: Factor['trend'] }): React.ReactElement {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-red-400" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-green-400" />;
  return <Minus className="h-4 w-4 text-neutral-500" />;
}

function FactorCard({ factor }: { factor: Factor }): React.ReactElement {
  const colorKey = getLevelColor(factor.score);
  const barColor = SCORE_BAR_COLORS[colorKey] ?? 'bg-amber-500';

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-neutral-400">{factor.name}</span>
        <TrendIcon trend={factor.trend} />
      </div>
      <p className="text-3xl font-bold">{factor.score}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-neutral-800">
        <div className={`h-1.5 rounded-full ${barColor}`}
          style={{ width: `${factor.score}%` }} />
      </div>
      <p className="mt-2 text-xs text-neutral-500">Weight: {factor.weight}%</p>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function EventsTable({ events }: { events: ThreatEvent[] }): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-medium mb-4">Recent Threat Events</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400">
              <th className="text-left py-2 pr-4 font-medium">Type</th>
              <th className="text-left py-2 pr-4 font-medium">Severity</th>
              <th className="text-left py-2 pr-4 font-medium">Source</th>
              <th className="text-left py-2 pr-4 font-medium">Time</th>
              <th className="text-left py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {events.map((ev) => (
              <tr key={ev.id} className="hover:bg-neutral-800/30 transition">
                <td className="py-2.5 pr-4 text-neutral-300">{ev.type}</td>
                <td className="py-2.5 pr-4">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[ev.severity]}`}>
                    {ev.severity}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-neutral-400">{ev.source}</td>
                <td className="py-2.5 pr-4 text-xs text-neutral-500">
                  {formatTimestamp(ev.timestamp)}
                </td>
                <td className="py-2.5 text-neutral-300">{ev.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ThreatLevelClient(): React.ReactElement {
  const [threat, setThreat] = useState<ThreatLevel | null>(null);
  const [events, _setEvents] = useState<ThreatEvent[]>([]);
  const [scoreHistory, _setScoreHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreatLevel()
      .then((real) => { if (real) setThreat(real); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading threat data...
        </div>
      )}
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Gauge className="h-8 w-8 text-info" />
          Organization Threat Level
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Real-time threat score combining active incidents, vulnerabilities,
          agent risk, cloud posture, identity risk, and compliance gaps.
        </p>
      </div>

      {!loading && !threat ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Gauge className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Threat Level Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing threat level analysis. Data will appear here automatically.
          </p>
        </div>
      ) : threat ? (
        <>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-8">
            <ThreatGauge score={threat.score} delta={threat.delta} />
          </div>

          {scoreHistory.length > 0 && (
            <ThreatSparkline data={scoreHistory} />
          )}

          <div>
            <h2 className="text-2xl font-semibold mb-4">Contributing Factors</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {threat.factors.map((f) => <FactorCard key={f.name} factor={f} />)}
            </div>
          </div>

          {events.length > 0 && <EventsTable events={events} />}
        </>
      ) : null}
    </div>
  );
}
