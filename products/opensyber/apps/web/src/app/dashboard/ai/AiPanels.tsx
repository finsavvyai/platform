import Link from 'next/link';
import { Brain } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AiInsight, AiRecommendation } from './types';
import { severityColors, categoryColors, statusColors, priorityColors } from './types';
import { RecommendationActions } from './recommendations/RecommendationActions';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-neutral-800 bg-neutral-900/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
        <Brain className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold mb-1">No AI insights yet</h3>
      <p className="text-sm text-neutral-400 max-w-sm mb-4">AI insights will appear here as the system analyzes your security data.</p>
      <Link href="/dashboard/ai/query"
        className="bg-info hover:bg-info text-white rounded-lg px-4 py-2 text-sm transition">
        Ask a security question
      </Link>
    </div>
  );
}

export function RecentInsightsTable({ insights }: { insights: AiInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Recent Insights</h2>
        <Link href="/dashboard/ai/insights" className="text-sm text-info hover:text-info transition">View all</Link>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="pb-3 font-medium">Title</th>
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium">Severity</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {insights.map((insight) => (
              <tr key={insight.id} className="group">
                <td className="py-3 font-medium text-neutral-200">{insight.title}</td>
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
                <td className="py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[insight.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
                    {insight.status}
                  </span>
                </td>
                <td className="py-3 text-neutral-500 whitespace-nowrap">{formatDate(insight.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TopRecommendations({ recommendations }: { recommendations: AiRecommendation[] }) {
  if (recommendations.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Top Recommendations</h2>
        <Link href="/dashboard/ai/recommendations" className="text-sm text-info hover:text-info transition">View all</Link>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${priorityColors[rec.priority] ?? 'bg-neutral-800 text-neutral-300'}`}>
                {rec.priority}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-200 truncate">{rec.title}</p>
                <p className="text-xs text-neutral-400 truncate">{rec.action}</p>
              </div>
            </div>
            {rec.status === 'pending' && <RecommendationActions id={rec.id} />}
            {rec.status !== 'pending' && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusColors[rec.status]}`}>
                {rec.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
