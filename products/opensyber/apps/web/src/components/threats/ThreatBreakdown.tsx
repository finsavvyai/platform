'use client';

import { motion } from 'framer-motion';

interface TypeData {
  eventType: string;
  eventCount: number;
}

interface SeverityData {
  severity: string;
  eventCount: number;
}

interface ThreatBreakdownProps {
  byType: TypeData[];
  bySeverity: SeverityData[];
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500 text-red-100',
  warning: 'bg-amber-500 text-amber-100',
  info: 'bg-info text-info',
};

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ThreatBreakdown({ byType, bySeverity }: ThreatBreakdownProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* By event type */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4">Event Types</h3>
        {byType.length === 0 ? (
          <p className="text-sm text-text-dim">No event type data.</p>
        ) : (
          <div className="space-y-2">
            {byType.map((item, i) => (
              <motion.div
                key={item.eventType}
                className="flex items-center justify-between rounded-lg bg-surface/50 px-3 py-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="text-sm text-text-primary">{formatType(item.eventType)}</span>
                <span className="text-sm font-medium">{item.eventCount.toLocaleString()}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* By severity */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4">Severity Distribution</h3>
        {bySeverity.length === 0 ? (
          <p className="text-sm text-text-dim">No severity data.</p>
        ) : (
          <div className="space-y-3">
            {bySeverity.map((item, i) => (
              <motion.div
                key={item.severity}
                className="flex items-center gap-3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${severityColors[item.severity] ?? 'bg-neutral-700 text-text-primary'}`}>
                  {item.severity}
                </span>
                <span className="text-sm font-medium flex-1 text-right">
                  {item.eventCount.toLocaleString()}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
