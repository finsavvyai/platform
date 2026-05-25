'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { ScoreGauge } from '@/components/score/ScoreGauge';
import { GradeDisplay } from '@/components/score/GradeDisplay';
import { CategoryBreakdown } from '@/components/score/CategoryBreakdown';
import { ShareButtons } from '@/components/ShareButtons';

interface ScorecardData {
  overall: number;
  grade: string;
  instanceName: string;
  lastUpdated: string;
  categories: Record<string, number>;
  recommendationCount: number;
}

interface ScorecardClientProps {
  instanceId: string;
}

export default function ScorecardClient({ instanceId }: ScorecardClientProps) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch(`/api/proxy/score/${instanceId}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchScore();
  }, [instanceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-info" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
          <Shield className="h-6 w-6 text-text-secondary" />
        </div>
        <h3 className="text-base font-semibold mb-1">Scorecard Not Found</h3>
        <p className="text-sm text-text-secondary max-w-sm">
          This security scorecard is not available or the instance has no score history.
        </p>
      </div>
    );
  }

  const shareUrl = `/score/${instanceId}`;
  const shareText = `My AI agent "${data.instanceName}" scored ${data.grade} (${data.overall}/100) on OpenSyber Security!`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Security Scorecard</h1>
        <p className="text-lg text-text-secondary">{data.instanceName}</p>
      </div>

      {/* Score + Grade */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-12">
        <ScoreGauge score={data.overall} />
        <div className="flex flex-col items-center gap-3">
          <GradeDisplay grade={data.grade} />
          <p className="text-xs text-text-dim">
            Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
          </p>
          {data.recommendationCount > 0 && (
            <p className="text-xs text-amber-400">
              {data.recommendationCount} recommendation{data.recommendationCount > 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </div>

      {/* Share */}
      <div className="flex justify-center">
        <ShareButtons url={shareUrl} text={shareText} title="Security Scorecard" />
      </div>

      {/* Categories */}
      <CategoryBreakdown categories={data.categories} />

      {/* Branding */}
      <div className="text-center pt-4 border-t border-border">
        <p className="text-xs text-text-dim">
          Secured by <span className="font-medium text-text-secondary">OpenSyber</span>
        </p>
      </div>
    </div>
  );
}
