import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import { monitoringApi, MonitorProfile, MonitorDashboard } from '../api/monitoring';
import MonitorProfileCard from './MonitorProfileCard';
import AddMonitorModal from './AddMonitorModal';
import { MonitoringIngestCard } from '../components/monitoring/MonitoringIngestCard';

export function Monitoring() {
  const { t } = useTranslation('monitoring');
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<MonitorProfile[]>([]);
  const [dashboard, setDashboard] = useState<MonitorDashboard | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadData = async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        monitoringApi.listProfiles(),
        monitoringApi.getDashboard(),
      ]);
      setProfiles(pRes.profiles || []);
      setDashboard(dRes);
    } catch { /* handled by client */ }
  };

  useEffect(() => { loadData(); }, []);

  const stats = [
    { name: 'Active Profiles', value: dashboard?.active_profiles ?? 0, icon: Shield },
    { name: 'Pending Alerts', value: dashboard?.pending_alerts ?? 0, icon: AlertTriangle },
    { name: 'Total Alerts', value: dashboard?.total_alerts ?? 0, icon: Clock },
    { name: 'Total Profiles', value: dashboard?.total_profiles ?? 0, icon: Shield },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        description="Continuously monitor your entire customer base — individuals and companies — against global sanctions, PEP, and adverse-media lists. Add entities manually, import your customer base as CSV, or sync automatically via webhook from your CRM or KYC provider."
      />
      <MonitoringIngestCard
        onAddManual={() => setShowAdd(true)}
        onImport={() => navigate('/monitoring/import')}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-lg mb-xxl">
        {stats.map((s) => (
          <Card key={s.name}>
            <div className="flex items-center justify-between mb-sm">
              <p className="sf-caption">{s.name}</p>
              <s.icon className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="sf-headline text-lg font-bold">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="space-y-md">
        {profiles.map((p) => (
          <MonitorProfileCard key={p.id} profile={p} onUpdate={loadData} />
        ))}
        {profiles.length === 0 && (
          <Card><p className="sf-body text-apple-text-secondary text-center py-xl">
            No monitored entities yet. Add one, import a CSV, or connect a webhook to get started.
          </p></Card>
        )}
      </div>
      {showAdd && <AddMonitorModal onClose={() => setShowAdd(false)} onCreated={loadData} />}
    </div>
  );
}
