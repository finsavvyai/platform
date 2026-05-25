import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAlertSummary } from '../../hooks/useAlertSummary';
import type { Alert } from '../../types';

interface Props {
  alert: Alert;
}

export function AISummaryCard({ alert }: Props) {
  const { state, generate } = useAlertSummary(alert);
  const [expanded, setExpanded] = useState(true);
  const isLoading = state.status === 'loading';

  return (
    <Card>
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <Sparkles className="w-4 h-4 text-[#C9A96E]" />
          <h3 className="sf-headline">AI Summary</h3>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'var(--dash-surface)', color: 'var(--dash-text-tertiary)' }}
          >
            Beta
          </span>
        </div>
        {state.status === 'done' && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-apple-label-secondary hover:text-[var(--dash-text)]"
            aria-label={expanded ? 'Collapse summary' : 'Expand summary'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {state.status === 'idle' && (
        <div className="flex flex-col items-start gap-md">
          <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            Generate a concise analyst summary using Claude AI.
          </p>
          <Button variant="secondary" size="sm" onClick={generate}>
            <Sparkles className="w-3.5 h-3.5 mr-xs" />
            Generate summary
          </Button>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center gap-sm py-sm">
          <span className="inline-block w-4 h-4 border-2 border-[#C9A96E]/30 border-t-[#C9A96E] rounded-full animate-spin" />
          <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            Analysing alert…
          </span>
        </div>
      )}

      {state.status === 'done' && expanded && (
        <div className="space-y-md">
          <p className="sf-body leading-relaxed" style={{ color: 'var(--dash-text)' }}>
            {state.summary}
          </p>
          <div className="flex items-center justify-between pt-sm" style={{ borderTop: '0.5px solid var(--dash-border)' }}>
            <span className="text-[10px]" style={{ color: 'var(--dash-text-tertiary)' }}>
              {state.model}
            </span>
            <button
              type="button"
              onClick={generate}
              disabled={isLoading}
              aria-label="Regenerate AI summary"
              className="text-[11px] underline disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: 'var(--dash-text-tertiary)' }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-sm p-md rounded-apple-md"
          style={{ background: 'rgba(255,59,48,0.08)' }}>
          <AlertCircle className="w-4 h-4 text-apple-red mt-0.5 shrink-0" />
          <div>
            <p className="sf-caption text-apple-red">{state.message}</p>
            <p className="text-[11px] mt-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
              Backend endpoint <code>POST /api/v1/ai/summarize</code> may be unavailable.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
