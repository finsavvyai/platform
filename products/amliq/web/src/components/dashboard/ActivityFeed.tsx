import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Search, Clock, Shield } from 'lucide-react';
import { api } from '../../api/client';

interface AuditEntry {
  id: string;
  action: string;
  entity_name?: string;
  description?: string;
  created_at: string;
}

const icons: Record<string, typeof CheckCircle> = {
  screening: Search, alert_resolved: CheckCircle,
  alert_escalated: AlertCircle, alert_created: Clock,
};

const dotColors: Record<string, string> = {
  screening: 'bg-amber-500 shadow-sm',
  alert_resolved: 'bg-emerald-500 ',
  alert_escalated: 'bg-amber-500 shadow-sm',
  alert_created: 'bg-apple-label-tertiary',
};

const iconColors: Record<string, string> = {
  screening: 'text-amber-500', alert_resolved: 'text-emerald-500',
  alert_escalated: 'text-amber-500', alert_created: 'text-apple-label-tertiary',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ActivityFeed() {
  const { t } = useTranslation('dashboard');
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api.get<{ entries: AuditEntry[] }>('/audit?limit=8')
      .then(d => setEntries(d?.entries ?? []))
      .catch(() => setEntries([]))
  }, []);

  const hasEntries = entries.length > 0;

  return (
    <div className="card-vibrancy p-xl h-full">
      <h3 className="sf-headline mb-lg">{t('recent_activity') || 'Recent Activity'}</h3>
      {!hasEntries && (
        <div className="flex flex-col items-center justify-center py-xl text-center">
          <Shield className="w-8 h-8 text-apple-label-tertiary mb-md" />
          <p className="sf-caption text-apple-label-tertiary">
            No activity yet. Start screening to see results here.
          </p>
        </div>
      )}
      {hasEntries && (
        <div className="relative ml-2">
          <div className="absolute left-[5px] top-1 bottom-1 w-px" style={{ background: 'linear-gradient(to bottom, var(--dash-border), transparent)' }} />
          <div className="space-y-lg">
            {entries.map((item) => {
              const type = item.action ?? 'screening';
              const Icon = icons[type] ?? Search;
              return (
                <div key={item.id}
                  className="relative flex items-start gap-md pl-6 py-sm rounded-apple-md
                    hover:bg-[var(--dash-surface)] transition-all cursor-default">
                  <div className={`absolute left-0 top-[10px] w-[11px] h-[11px] rounded-full ${dotColors[type] ?? dotColors.screening}`} />
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColors[type] ?? iconColors.screening}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate" style={{ color: 'var(--dash-text)' }}>
                      {item.entity_name ?? item.description ?? item.action}
                    </p>
                    <p className="text-[11px] mt-px" style={{ color: 'var(--dash-text-tertiary)' }}>
                      {item.action} &middot; {timeAgo(item.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
