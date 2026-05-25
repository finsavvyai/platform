import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export const metadata = { title: 'SOC 2 Readiness Dashboard' };

interface DynamicEvidence {
  tsc: string;
  category: string;
  status: 'pass' | 'fail' | 'partial';
  source: string;
  recordCount: number;
  description: string;
}

interface StaticEvidence {
  controlId: string;
  tsc: string;
  evidenceType: string;
  title: string;
  description: string;
}

interface Gap {
  tsc: string;
  category: string;
  description: string;
  recommendation: string;
}

interface EvidenceResponse {
  data: {
    framework: string;
    staticEvidence: { items: StaticEvidence[]; summary: { coveragePercent: number } };
    dynamicEvidence: { items: DynamicEvidence[]; readinessScore: number };
    gaps: Gap[];
    overallReadiness: number;
  };
}

const STATUS_STYLES: Record<string, string> = {
  pass: 'bg-emerald-500/20 text-emerald-400',
  partial: 'bg-amber-500/20 text-amber-400',
  fail: 'bg-red-500/20 text-red-400',
};

export default async function Soc2ReadinessPage() {
  const token = await getApiToken();
  if (!token) return <p className="text-gray-500">Unauthorized</p>;

  let data: EvidenceResponse['data'] | null = null;
  try {
    const res = await apiClient<EvidenceResponse>('/api/compliance/evidence/soc2', { token });
    data = res.data;
  } catch {
    return <p className="text-gray-500">Failed to load SOC 2 evidence.</p>;
  }

  if (!data) return <p className="text-gray-500">No data available.</p>;

  const { staticEvidence, dynamicEvidence, gaps, overallReadiness } = data;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex items-center gap-6">
        <div className="relative h-24 w-24">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1E2A38" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={overallReadiness >= 70 ? '#10B981' : overallReadiness >= 40 ? '#F59E0B' : '#EF4444'}
              strokeWidth="8"
              strokeDasharray={`${overallReadiness * 2.64} 264`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
            {overallReadiness}%
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">SOC 2 Readiness</h1>
          <p className="text-sm text-gray-400 mt-1">
            Overall readiness score based on {staticEvidence.items.length} architectural controls
            and {dynamicEvidence.items.length} live evidence checks.
          </p>
        </div>
      </div>

      {/* Dynamic Evidence (Live) */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Live Evidence Checks</h2>
        <div className="space-y-3">
          {dynamicEvidence.items.map((item) => (
            <div
              key={item.tsc + item.source}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">{item.tsc}</span>
                  <span className="text-sm font-medium text-white">{item.category}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{item.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{item.recordCount} records</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[item.status]}`}>
                  {item.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gaps */}
      {gaps.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Gaps ({gaps.length})
          </h2>
          <div className="space-y-3">
            {gaps.map((gap) => (
              <div
                key={gap.tsc}
                className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-red-400">{gap.tsc}</span>
                  <span className="text-sm font-medium text-white">{gap.category}</span>
                </div>
                <p className="text-xs text-gray-400">{gap.description}</p>
                <p className="text-xs text-teal-400 mt-2">{gap.recommendation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Static Evidence */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Architectural Controls ({staticEvidence.summary.coveragePercent}% TSC coverage)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staticEvidence.items.map((item) => (
            <div
              key={item.controlId}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-500">{item.controlId}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/20 text-info">
                  {item.tsc}
                </span>
              </div>
              <p className="text-sm text-white">{item.title}</p>
              <p className="text-xs text-gray-400 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
