'use client';

import { Shield, Download, Check } from 'lucide-react';
import type { RulePack, RulePackCategory, RuleDefinition } from './builder-types';
import { CATEGORY_LABELS, CATEGORY_COLORS, SEVERITY_COLORS } from './builder-types';

interface RulePackCardProps {
  pack: RulePack;
  isInstalled: boolean;
  installing: boolean;
  onInstall: (packId: string) => void;
  onPreview: (pack: RulePack) => void;
}

function parseRules(rulesJson: string): RuleDefinition[] {
  try {
    return JSON.parse(rulesJson);
  } catch {
    return [];
  }
}

export function RulePackCard({ pack, isInstalled, installing, onInstall, onPreview }: RulePackCardProps) {
  const rules = parseRules(pack.rules);
  const category = pack.category as RulePackCategory;

  return (
    <div
      className="group rounded border border-border bg-panel/30 p-5 transition hover:border-wire cursor-pointer"
      onClick={() => onPreview(pack)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface">
            <Shield className="h-4 w-4 text-text-secondary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">{pack.name}</h3>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[category] ?? ''}`}>
              {CATEGORY_LABELS[category] ?? category}
            </span>
          </div>
        </div>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[pack.severity]}`}>
          {pack.severity}
        </span>
      </div>

      <p className="text-xs text-text-dim mb-4 line-clamp-2">{pack.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-dim">
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </span>
        <button
          disabled={isInstalled || installing}
          onClick={(e) => { e.stopPropagation(); onInstall(pack.id); }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            isInstalled
              ? 'bg-green-500/10 text-green-400 cursor-default'
              : 'bg-signal text-white hover:bg-signal-hover disabled:opacity-50'
          }`}
        >
          {isInstalled ? (
            <><Check className="h-3 w-3" /> Installed</>
          ) : (
            <><Download className="h-3 w-3" /> {installing ? 'Installing...' : 'Install'}</>
          )}
        </button>
      </div>
    </div>
  );
}
