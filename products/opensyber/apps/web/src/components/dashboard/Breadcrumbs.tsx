'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  skills: 'Skills',
  logs: 'Audit Logs',
  notifications: 'Notifications',
  marketplace: 'Marketplace',
  settings: 'Settings',
  security: 'Agent Activity',
  'cloud-security': 'Cloud Security',
  cspm: 'CSPM Findings',
  'team-agents': 'Team Agents',
  policies: 'Agent Policies',
  channels: 'Alert Channels',
  violations: 'Violations',
  'attack-paths': 'Attack Paths',
  'asset-inventory': 'Asset Inventory',
  oasf: 'OASF Compliance',
  soc2: 'SOC2 Readiness',
  sla: 'SLA Monitor',
  'slo-dashboard': 'SLO Dashboard',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: LABEL_MAP[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs text-text-dim">
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {!crumb.isLast ? (
            <>
              <Link href={crumb.href} className="hover:text-text-primary transition-colors">
                {crumb.label}
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </>
          ) : (
            <span className="text-text-secondary">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
