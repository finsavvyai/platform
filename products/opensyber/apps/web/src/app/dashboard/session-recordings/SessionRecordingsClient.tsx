'use client';

import { useState, useMemo, useEffect } from 'react';
import { Monitor, Loader2 } from 'lucide-react';
import type { SessionRecording, SessionStats } from './types';
import { SessionStatsCards } from './SessionStatsCards';
import { SessionTypeChart } from './SessionTypeChart';
import { SessionFilters } from './SessionFilters';
import { SessionTable } from './SessionTable';
import { SessionPlayer } from './SessionPlayer';

function filterByRisk(s: SessionRecording, level: string): boolean {
  if (level === 'high') return s.riskScore >= 70;
  if (level === 'medium') return s.riskScore >= 40 && s.riskScore < 70;
  if (level === 'low') return s.riskScore < 40;
  return true;
}

function buildStats(sessions: SessionRecording[]): SessionStats {
  const active = sessions.filter((s) => s.status === 'active').length;
  const flagged = sessions.filter((s) => s.status === 'flagged').length;
  const totalDur = sessions.reduce((sum, s) => sum + s.duration, 0);
  const ssh = sessions.filter((s) => s.sessionType === 'SSH').length;
  const web = sessions.filter((s) => s.sessionType === 'Web').length;
  const api = sessions.filter((s) => s.sessionType === 'API').length;
  const total = ssh + web + api || 1;
  return {
    totalSessions: sessions.length,
    activeNow: active,
    flagged,
    avgDuration: sessions.length > 0 ? Math.round(totalDur / sessions.length) : 0,
    byType: { ssh: Math.round((ssh / total) * 100), web: Math.round((web / total) * 100), api: Math.round((api / total) * 100) },
  };
}

const emptyStats: SessionStats = {
  totalSessions: 0,
  activeNow: 0,
  flagged: 0,
  avgDuration: 0,
  byType: { ssh: 0, web: 0, api: 0 },
};

export default function SessionRecordingsClient(): React.ReactElement {
  const [sessions, setSessions] = useState<SessionRecording[]>([]);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [sessionType, setSessionType] = useState('all');
  const [riskLevel, setRiskLevel] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [activeSession, setActiveSession] = useState<SessionRecording | null>(null);

  useEffect(() => {
    fetch('/api/proxy/agents/sessions')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data) && d.data.length) {
          const mapped = d.data.map(mapApiSession);
          setSessions(mapped);
          setStats(buildStats(mapped));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (sessionType !== 'all' && s.sessionType !== sessionType) return false;
      if (!filterByRisk(s, riskLevel)) return false;
      if (flaggedOnly && s.status !== 'flagged') return false;
      if (userFilter && !s.user.toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });
  }, [sessions, sessionType, riskLevel, flaggedOnly, userFilter]);

  if (!loading && sessions.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Monitor className="h-8 w-8 text-info" />
            Session Recordings
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Record and replay privileged sessions for security audit and compliance.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Monitor className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Session Recordings Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start recording sessions. Data will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading session data...
        </div>
      )}
      <SessionStatsCards stats={stats} />
      <SessionTypeChart stats={stats} />
      <SessionFilters
        sessionType={sessionType}
        onSessionTypeChange={setSessionType}
        riskLevel={riskLevel}
        onRiskLevelChange={setRiskLevel}
        flaggedOnly={flaggedOnly}
        onFlaggedOnlyChange={setFlaggedOnly}
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
      />
      <SessionTable sessions={filtered} onPlay={setActiveSession} />
      {activeSession && (
        <SessionPlayer session={activeSession} onClose={() => setActiveSession(null)} />
      )}
    </>
  );
}

function mapApiSession(s: Record<string, unknown>): SessionRecording {
  return {
    id: String(s.id ?? ''),
    user: String(s.user ?? s.userId ?? 'Unknown'),
    userEmail: String(s.userEmail ?? s.email ?? ''),
    sessionType: (['SSH', 'Web', 'API'].includes(String(s.sessionType)) ? String(s.sessionType) : 'SSH') as 'SSH' | 'Web' | 'API',
    target: String(s.target ?? s.hostname ?? 'unknown'),
    duration: Number(s.duration ?? 0),
    riskScore: Number(s.riskScore ?? 0),
    status: (['active', 'completed', 'flagged'].includes(String(s.status)) ? String(s.status) : 'completed') as 'active' | 'completed' | 'flagged',
    startedAt: String(s.startedAt ?? s.createdAt ?? new Date().toISOString()),
    commands: Array.isArray(s.commands) ? s.commands : [],
  };
}
