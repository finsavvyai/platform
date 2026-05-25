'use client';

import { useState, useEffect } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import type { RiskyUser, AnomalyEvent } from './types';
import { RiskOverview } from './RiskOverview';
import { AnomalyTable } from './AnomalyTable';
import { RiskyUsersTable } from './RiskyUsersTable';
import { UserTimeline } from './UserTimeline';
import { fetchBehaviorData } from './fetch-behavior';

export function BehaviorAnalyticsClient(): React.ReactElement {
  const [users, setUsers] = useState<RiskyUser[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBehaviorData()
      .then((real) => {
        if (real) {
          setUsers(real.users);
          setAnomalies(real.anomalies);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  function handleDismiss(anomalyId: string): void {
    setAnomalies((prev) => prev.filter((a) => a.id !== anomalyId));
  }

  function handleSuspend(userId: string): void {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, status: 'Suspended' as const } : u
      )
    );
  }

  function handleInvestigate(userId: string): void {
    setSelectedUserId(userId);
  }

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading behavior data...
        </div>
      )}
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Activity className="h-8 w-8 text-info" />
          User Behavior Analytics
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Detects anomalous user behavior patterns across your
          organization. Identifies impossible travel, mass downloads,
          privilege escalation attempts, and unusual API usage.
        </p>
      </div>

      {!loading && users.length === 0 && anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Activity className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Behavior Analytics Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing user behavior analytics. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <RiskOverview users={users} />
          <AnomalyTable
            anomalies={anomalies}
            onInvestigate={handleInvestigate}
            onDismiss={handleDismiss}
            onSuspend={handleSuspend}
          />
          <RiskyUsersTable users={users} onSelect={handleInvestigate} />

          {selectedUser && (
            <UserTimeline
              userId={selectedUser.id}
              userName={selectedUser.name}
              onClose={() => setSelectedUserId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
