'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { ApiEndpoint, ApiAttack, ApiStats, HourlyAttacks, ApiVulnerability } from './types';
import { ApiStatsRow } from './ApiStatsRow';
import { ApiInventoryTable } from './ApiInventoryTable';
import { AttackTimeline } from './AttackTimeline';
import { TopVulnerabilities } from './TopVulnerabilities';
import { EndpointDetail } from './EndpointDetail';

const emptyStats: ApiStats = {
  totalEndpoints: 0,
  highRiskEndpoints: 0,
  attacks24h: 0,
  authIssues: 0,
};

const endpoints: ApiEndpoint[] = [];
const attacks: ApiAttack[] = [];
const hourlyData: HourlyAttacks[] = [];
const vulnerabilities: ApiVulnerability[] = [];

export function ApiSecurityClient(): React.ReactElement {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  const endpoint = endpoints.find((e) => e.id === selectedEndpoint);
  const endpointAttacks = endpoint
    ? attacks.filter((a) => a.endpointPath === endpoint.path)
    : [];

  const hasData = endpoints.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Lock className="h-8 w-8 text-info" />
          API Security
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Discover, monitor, and protect your API endpoints. Identify
          high-risk APIs, track attack attempts, and remediate OWASP
          API Top 10 vulnerabilities.
        </p>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Lock className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No API Security Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start monitoring API security. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <ApiStatsRow stats={emptyStats} />
          <ApiInventoryTable
            endpoints={endpoints}
            onInvestigate={setSelectedEndpoint}
          />

          {endpoint && (
            <EndpointDetail
              endpoint={endpoint}
              attacks={endpointAttacks}
              onClose={() => setSelectedEndpoint(null)}
            />
          )}

          <AttackTimeline data={hourlyData} />
          <TopVulnerabilities vulnerabilities={vulnerabilities} />
        </>
      )}
    </div>
  );
}
