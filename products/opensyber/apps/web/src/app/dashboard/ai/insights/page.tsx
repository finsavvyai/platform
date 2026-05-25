import { Lightbulb } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { formatDate } from '@/lib/utils';
import type { AiInsight } from '../types';
import { severityColors, categoryColors } from '../types';
import { InsightActions } from './InsightActions';
import { GenerateInsightsButton } from './GenerateInsightsButton';

export const metadata = { title: 'AI Insights' };

export default async function InsightsPage() {
  let insights: AiInsight[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const base = process.env.NEXT_PUBLIC_APP_URL || '';
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch(`${base}/api/proxy/ai/insights`, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { data: AiInsight[] } | { insights: AiInsight[] };
        insights = ('data' in data ? data.data : data.insights) ?? [];
      }
    }
  } catch { /* API not available */ }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Insights</h1>
          <p className="text-sm text-neutral-400 mt-1">AI-generated security insights across your environment</p>
        </div>
        <GenerateInsightsButton />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
              <Lightbulb className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">No insights yet</h3>
            <p className="text-sm text-neutral-400 max-w-sm">
              Click &quot;Generate Insights&quot; to analyze your security data with AI.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-400">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Severity</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {insights.map((insight) => (
                  <tr key={insight.id} className="group">
                    <td className="py-3 max-w-xs">
                      <p className="font-medium text-neutral-200 truncate">{insight.title}</p>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{insight.description}</p>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[insight.category] ?? 'bg-neutral-800 text-neutral-300'}`}>
                        {insight.category}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[insight.severity] ?? 'bg-neutral-800 text-neutral-300'}`}>
                        {insight.severity}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-400">{insight.source}</td>
                    <td className="py-3 text-neutral-500 whitespace-nowrap">{formatDate(insight.createdAt)}</td>
                    <td className="py-3">
                      <InsightActions id={insight.id} currentStatus={insight.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
