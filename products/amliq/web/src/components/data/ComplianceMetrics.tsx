import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from './StatCard';
import { api } from '../../api/client';

interface ComplianceStats {
  openCases: number;
  activeMonitors: number;
  highRiskEntities: number;
  pendingEDD: number;
  unreviewedMedia: number;
  txnAlerts: number;
}

export function ComplianceMetrics() {
  const { t } = useTranslation('dashboard');
  const [stats, setStats] = useState<ComplianceStats | null>(null);

  useEffect(() => {
    api.get<ComplianceStats>('/dashboard/compliance')
      .then((data) => setStats(data ?? null))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  return (
    <div>
      <h3 className="sf-headline mb-lg">{t('compliance_overview')}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-lg">
        <StatCard title={t('open_cases')} value={stats.openCases} color="orange" />
        <StatCard title={t('active_monitors')} value={stats.activeMonitors} />
        <StatCard title={t('high_risk')} value={stats.highRiskEntities} color="red" />
        <StatCard title={t('pending_edd')} value={stats.pendingEDD} color="orange" />
        <StatCard title={t('unreviewed_media')} value={stats.unreviewedMedia} />
        <StatCard title={t('txn_alerts')} value={stats.txnAlerts} color="red" />
      </div>
    </div>
  );
}
