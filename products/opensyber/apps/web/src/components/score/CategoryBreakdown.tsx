'use client';

import { motion } from 'framer-motion';

interface CategoryBreakdownProps {
  categories: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, string> = {
  credentialSecurity: 'Credential Security',
  skillSafety: 'Skill Safety',
  networkSecurity: 'Network Security',
  updateStatus: 'Update Status',
  configurationHardening: 'Configuration Hardening',
  vulnerabilityManagement: 'Vulnerability Management',
  incidentReadiness: 'Incident Readiness',
};

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const entries = Object.entries(categories);

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
      <div className="space-y-4">
        {entries.map(([key, value], i) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-text-primary">{CATEGORY_LABELS[key] ?? key}</span>
              <span className={`font-medium ${scoreTextColor(value)}`}>{value}/100</span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor(value)}`}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{
                  delay: i * 0.08,
                  duration: 0.8,
                  ease: [0.25, 0.1, 0.25, 1] as const,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
