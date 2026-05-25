import { Sparkles } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { formatDate } from '@/lib/utils';
import type { AiRecommendation } from '../types';
import { priorityColors, statusColors } from '../types';
import { RecommendationActions } from './RecommendationActions';

export const metadata = { title: 'AI Recommendations' };

export default async function RecommendationsPage() {
  let recommendations: AiRecommendation[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const base = process.env.NEXT_PUBLIC_APP_URL || '';
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch(`${base}/api/proxy/ai/recommendations`, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { data: AiRecommendation[] } | { recommendations: AiRecommendation[] };
        recommendations = ('data' in data ? data.data : data.recommendations) ?? [];
      }
    }
  } catch { /* API not available */ }

  const appliedCount = recommendations.filter((r) => r.status === 'applied').length;
  const pendingCount = recommendations.filter((r) => r.status === 'pending').length;
  const skippedCount = recommendations.filter((r) => r.status === 'skipped').length;

  const stats = [
    { label: 'Pending', count: pendingCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Applied', count: appliedCount, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Skipped', count: skippedCount, color: 'text-neutral-400', bg: 'bg-neutral-800' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Recommendations</h1>
        <p className="text-sm text-neutral-400 mt-1">AI-generated security recommendations for your environment</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-neutral-800 bg-neutral-900/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Sparkles className="h-6 w-6 text-neutral-400" />
          </div>
          <h3 className="text-base font-semibold mb-1">No recommendations</h3>
          <p className="text-sm text-neutral-400 max-w-sm">
            AI recommendations will appear here as the system analyzes your security posture.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[rec.priority] ?? 'bg-neutral-800 text-neutral-300'}`}>
                      {rec.priority}
                    </span>
                    {rec.status !== 'pending' && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[rec.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
                        {rec.status}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-neutral-200 mb-1">{rec.title}</h3>
                  <p className="text-xs text-neutral-400 mb-1">{rec.description}</p>
                  <p className="text-xs text-neutral-500">{rec.action}</p>
                  <p className="text-xs text-neutral-600 mt-2">{formatDate(rec.createdAt)}</p>
                </div>
                {rec.status === 'pending' && <RecommendationActions id={rec.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
