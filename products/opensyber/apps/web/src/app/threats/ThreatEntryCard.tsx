'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Server, Hash, Link2, Package, ShieldAlert,
  ChevronDown, ChevronUp, ShieldCheck, ShieldOff,
} from 'lucide-react';
import type { ThreatEntry, IOC } from './threat-intel-types';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-info bg-info/10 border-info/20',
  info: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

const SOURCE_STYLES: Record<string, string> = {
  'opensyber-research': 'text-signal bg-signal/10',
  nvd: 'text-purple-400 bg-purple-500/10',
  circl: 'text-cyan-400 bg-cyan-500/10',
  community: 'text-green-400 bg-green-500/10',
};

const IOC_ICONS: Record<IOC['type'], typeof Globe> = {
  domain: Globe, ip: Server, hash: Hash, url: Link2,
  package: Package, cve: ShieldAlert,
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ThreatEntryCard({ entry, index }: { entry: ThreatEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasIndicators = entry.indicators.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="rounded-lg border border-border bg-panel/30 p-5 hover:border-border/80 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap mt-0.5 ${SEVERITY_STYLES[entry.severity] ?? ''}`}>
          {entry.severity}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary truncate">{entry.title}</h3>
            {entry.autoBlockEnabled ? (
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <ShieldCheck className="h-3 w-3" /> AUTO-BLOCK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-text-dim">
                <ShieldOff className="h-3 w-3" /> MONITOR
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{entry.description}</p>

          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-border text-text-dim">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${SOURCE_STYLES[entry.source] ?? 'text-text-dim bg-panel'}`}>
            {entry.source}
          </span>
          <span className="text-[10px] text-text-dim tabular-nums">{formatTimeAgo(entry.publishedAt)}</span>
          <span className="text-[10px] text-text-dim uppercase">{entry.type}</span>
        </div>
      </div>

      {hasIndicators && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-signal hover:text-signal/80 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {entry.indicators.length} indicator{entry.indicators.length > 1 ? 's' : ''}
          </button>

          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-2 space-y-1"
            >
              {entry.indicators.map((ind, i) => {
                const Icon = IOC_ICONS[ind.type] ?? ShieldAlert;
                return (
                  <div key={`${ind.type}-${ind.value}-${i}`} className="flex items-center gap-2 text-xs bg-panel/50 rounded px-3 py-1.5 border border-border/50">
                    <Icon className="h-3.5 w-3.5 text-text-dim shrink-0" />
                    <span className="text-[10px] uppercase text-text-dim w-14">{ind.type}</span>
                    <span className="text-text-primary font-mono text-[11px] truncate flex-1">{ind.value}</span>
                    <span className="text-[10px] text-text-dim tabular-nums">{ind.confidence}%</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
