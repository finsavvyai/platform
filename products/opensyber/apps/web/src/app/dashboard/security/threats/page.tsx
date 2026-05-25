import { Globe2, MapPin } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export const metadata = { title: 'Threat Map' };

interface ThreatMapEntry {
  country: string;
  count: number;
  severity: string;
}

interface ThreatMapData {
  totalEvents: number;
  entries: ThreatMapEntry[];
  topCountries: Array<{ country: string; count: number }>;
}

const severityBadge: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-signal/10 text-signal',
};

export default async function ThreatMapPage() {
  let threatData: ThreatMapData | null = null;

  let hasInstance = true;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const data = await apiClient<{ threatMap: ThreatMapData }>(
          `/api/security/instances/${instance.id}/threat-map`,
          { token },
        );
        threatData = data.threatMap ?? null;
      } else {
        hasInstance = false;
      }
    }
  } catch {
    // API not available
  }

  if (!hasInstance) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Threat Map</h1>
        <p className="text-sm text-text-secondary mb-8">Geographic distribution of security threats</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Globe2 className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instance deployed</h3>
          <p className="text-sm text-text-secondary max-w-sm">Deploy an instance to view threat geography data.</p>
        </div>
      </div>
    );
  }

  const countries = threatData?.entries ?? [];
  const hasGeoData = countries.length > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Threat Map</h1>
        <p className="text-sm text-text-secondary mt-1">Geographic distribution of security threats</p>
      </div>

      {!hasGeoData ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <MapPin className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No geographic threat data</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Threat geography data will appear here once security events with location information are detected.
          </p>
        </div>
      ) : (
        <>
          {/* Total events summary */}
          <div className="mb-8">
            <div className="rounded border border-border bg-panel/30 p-6">
              <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
                <Globe2 className="h-4 w-4" />
                Total Threat Events
              </div>
              <p className={`text-3xl font-bold ${(threatData?.totalEvents ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {threatData?.totalEvents ?? 0}
              </p>
              <p className="text-xs text-text-dim mt-1">
                across {countries.length} {countries.length === 1 ? 'country' : 'countries'}
              </p>
            </div>
          </div>

          {/* Top countries table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Top Countries</h3>
            <div className="rounded border border-border bg-panel/30 overflow-hidden">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-6 py-3 font-medium">Country</th>
                    <th className="px-6 py-3 font-medium">Event Count</th>
                    <th className="px-6 py-3 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {countries.map((entry, index) => (
                    <tr key={`${entry.country}-${index}`} className="hover:bg-surface/30 transition">
                      <td className="px-6 py-3 font-medium">{entry.country}</td>
                      <td className="px-6 py-3 font-mono text-xs">{entry.count}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            severityBadge[entry.severity] ?? 'bg-surface text-text-primary'
                          }`}
                        >
                          {entry.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
