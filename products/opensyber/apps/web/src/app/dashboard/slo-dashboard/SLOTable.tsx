'use client';


interface Integration {
  id: string;
  name: string;
  tier: string;
  status: 'healthy' | 'degraded' | 'down';
  lastSync: string;
  eventLatency: number;
  availability: number;
  sloTarget: number;
  breached: boolean;
}

interface SLOTableProps {
  integrations: Integration[];
}

const statusIcons = {
  healthy: 'h-3 w-3 bg-green-500 rounded-full',
  degraded: 'h-3 w-3 bg-yellow-500 rounded-full',
  down: 'h-3 w-3 bg-red-500 rounded-full',
};

const tiers = ['Cloud Security', 'Identity', 'IDE', 'SIEM'] as const;

export function SLOTable({ integrations }: SLOTableProps) {
  const groupedByTier = tiers.map((tier) => ({
    tier,
    items: integrations.filter((i) => i.tier === tier),
  }));

  return (
    <div className="space-y-6">
      {groupedByTier.map(({ tier, items }) => (
        <div key={tier}>
          <h2 className="text-lg font-bold text-white mb-3">{tier}</h2>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">Integration</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-300">Last Sync</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-300">Latency</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-300">
                    Availability
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-300">Target</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-300">Breach</th>
                </tr>
              </thead>
              <tbody>
                {items.map((int) => (
                  <tr key={int.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-white">{int.name}</td>
                    <td className="px-4 py-3 text-center">
                      <div className={statusIcons[int.status]} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(int.lastSync).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {int.eventLatency.toFixed(1)}ms
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {int.availability.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{int.sloTarget}%</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          int.breached
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}
                      >
                        {int.breached ? 'YES' : 'NO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      ))}
    </div>
  );
}
