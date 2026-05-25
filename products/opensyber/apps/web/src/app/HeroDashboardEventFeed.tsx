'use client';

import { useTranslations } from 'next-intl';

export function HeroDashboardEventFeed() {
  const t = useTranslations('hero');

  const events = [
    { severity: 'CRITICAL', color: 'bg-alert/10 text-alert border-alert/20', text: t('credentialBlocked'), time: '2m ago' },
    { severity: 'BLOCKED', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', text: 'Supply chain attack blocked — malicious postinstall', time: '8m ago' },
    { severity: 'INFO', color: 'bg-info/10 text-info border-info/20', text: t('skillAudit'), time: '15m ago' },
    { severity: 'OK', color: 'bg-ok/10 text-ok border-ok/20', text: t('heartbeatRestored'), time: '1h ago' },
    { severity: 'WARN', color: 'bg-warn/10 text-warn border-warn/20', text: 'Unusual egress pattern detected — 3 new domains', time: '2h ago' },
  ];

  return (
    <div className="rounded-xl bg-surface/50 border border-border p-5">
      <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim uppercase tracking-wider mb-4">Live Event Feed</p>
      <div className="space-y-2.5">
        {events.map((evt) => (
          <div key={evt.text} className="flex items-center justify-between rounded-lg bg-panel/60 border border-border/50 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <span className={`inline-block rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-wider border ${evt.color}`}>
                {evt.severity}
              </span>
              <span className="text-text-primary text-[12px]">{evt.text}</span>
            </div>
            <span className="text-text-dim text-[11px] hidden sm:block">{evt.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
