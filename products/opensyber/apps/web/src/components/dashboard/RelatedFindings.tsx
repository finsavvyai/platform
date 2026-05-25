'use client';

/**
 * RelatedFindings Component
 *
 * Expandable component that displays CSPM findings related to
 * an agent activity event. Lazy-loads findings on expansion.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

interface RelatedFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resourceId: string;
  resourceType: string;
  title: string;
}

interface RelatedFindingsProps {
  activityId: string;
  initialCount?: number;
}

const severityColors = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/20',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-signal bg-signal/10 border-info/20',
};

export function RelatedFindings({ activityId, initialCount }: RelatedFindingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [findings, setFindings] = useState<RelatedFinding[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    // Lazy-load findings on first expansion
    setIsExpanded(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/activity/${activityId}/related-findings`);
      if (!response.ok) {
        throw new Error('Failed to load findings');
      }

      const data = await response.json();
      setFindings(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Related Findings</span>
        </span>
        {initialCount !== undefined && initialCount > 0 && (
          <span className="px-2 py-0.5 bg-surface rounded-full text-xs">
            {initialCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Related Findings</span>
          {findings.length > 0 && (
            <span className="text-text-secondary">({findings.length})</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-text-secondary transform transition-transform" />
      </button>

      {/* Content */}
      <div className="border-t border-border">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            Loading findings...
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-red-400">
            {error}
          </div>
        ) : findings.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-dim">
            No related findings found
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-surface/30 transition-colors`}
              >
                {/* Severity indicator */}
                <div className={`mt-1 w-2 h-2 rounded-full ${severityColors[finding.severity]}`} />

                {/* Finding details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-neutral-200">
                      {finding.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${severityColors[finding.severity]}`}
                    >
                      {finding.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-dim">
                    <span className="font-mono">{finding.resourceType}</span>
                    <span>•</span>
                    <span className="font-mono truncate" title={finding.resourceId}>
                      {finding.resourceId}
                    </span>
                  </div>
                </div>

                {/* Chevron icon */}
                <ChevronRight className="w-4 h-4 text-text-dim flex-shrink-0 mt-1" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
