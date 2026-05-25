import Link from 'next/link';
import { Search, AlertTriangle, CheckCircle, Info, AlertOctagon } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import type { AiInsight, AiRecommendation } from './types';
import { EmptyState, RecentInsightsTable, TopRecommendations } from './AiPanels';

export const metadata = { title: 'AI Intelligence' };

async function fetchAiData(token: string, orgId: string | null) {
  const base = typeof window === 'undefined' ? process.env.NEXT_PUBLIC_APP_URL || '' : '';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(orgId ? { 'X-Org-Id': orgId } : {}),
  };
  const [insightsRes, recsRes] = await Promise.allSettled([
    fetch(`${base}/api/proxy/ai/insights`, { headers, cache: 'no-store' }),
    fetch(`${base}/api/proxy/ai/recommendations`, { headers, cache: 'no-store' }),
  ]);
  const insightsRaw: AiInsight[] = insightsRes.status === 'fulfilled' && insightsRes.value.ok
    ? await (async () => {
        const body = (await insightsRes.value.json()) as { data?: AiInsight[]; insights?: AiInsight[] };
        return body.data ?? body.insights ?? [];
      })()
    : [];
  const insights = insightsRaw;
  const recsRaw: AiRecommendation[] = recsRes.status === 'fulfilled' && recsRes.value.ok
    ? await (async () => {
        const body = (await recsRes.value.json()) as { data?: AiRecommendation[]; recommendations?: AiRecommendation[] };
        return body.data ?? body.recommendations ?? [];
      })()
    : [];
  const recommendations = recsRaw;
  return { insights, recommendations };
}

const severityIcons: Record<string, typeof AlertOctagon> = {
  critical: AlertOctagon, high: AlertTriangle, medium: Info, low: CheckCircle,
};

export default async function AiOverviewPage() {
  let insights: AiInsight[] = [];
  let recommendations: AiRecommendation[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await fetchAiData(token, null);
      insights = data.insights;
      recommendations = data.recommendations;
    }
  } catch { /* API not available */ }

  const criticalCount = insights.filter((i) => i.severity === 'critical').length;
  const highCount = insights.filter((i) => i.severity === 'high').length;
  const mediumCount = insights.filter((i) => i.severity === 'medium').length;
  const lowCount = insights.filter((i) => i.severity === 'low').length;

  const stats = [
    { label: 'Critical', count: criticalCount, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'High', count: highCount, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Medium', count: mediumCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Low', count: lowCount, color: 'text-info', bg: 'bg-info/10' },
  ];

  const hasData = insights.length > 0 || recommendations.length > 0;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Intelligence</h1>
          <p className="text-sm text-neutral-400 mt-1">AI-powered security insights and recommendations</p>
        </div>
        <Link href="/dashboard/ai/query"
          className="flex items-center gap-2 bg-info hover:bg-info text-white rounded-lg px-4 py-2 text-sm transition">
          <Search className="h-4 w-4" /> Ask a question
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = severityIcons[s.label.toLowerCase()] ?? Info;
          return (
            <div key={s.label} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <span className="text-xs text-neutral-400 uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
            </div>
          );
        })}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <RecentInsightsTable insights={insights.slice(0, 10)} />
          <TopRecommendations recommendations={recommendations.slice(0, 5)} />
        </>
      )}
    </div>
  );
}

