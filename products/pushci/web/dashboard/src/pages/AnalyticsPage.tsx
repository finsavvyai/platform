import { useState } from 'react';
import { useRuns } from '../hooks/useRuns';
import AnalyticsCards from '../components/AnalyticsCards';
import BuildTimeTrend from '../components/BuildTimeTrend';
import FlakeyTests from '../components/FlakeyTests';
import CostSavings from '../components/CostSavings';
import EmptyAnalyticsState from '../components/EmptyAnalyticsState';
import HotspotTable, { type HotspotRow } from '../components/HotspotTable';
import PageHeader from '../components/PageHeader';
import UpgradeBanner from '../components/UpgradeBanner';

type Tab = 'overview' | 'risk';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-surface-border text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function AnalyticsPage() {
  const { runs, loading } = useRuns();
  const [tab, setTab] = useState<Tab>('overview');
  // Hotspots are populated by `pushci intel hotspots` upload; empty until wired.
  const [hotspots] = useState<HotspotRow[]>([]);

  const showEmpty = !loading && runs.length === 0;

  return (
    <div className="space-y-6">
      <UpgradeBanner message="Get detailed build analytics with Pro" planRequired="pro" />
      <PageHeader title="Analytics" description="Pipeline performance and insights" />

      <div className="flex items-center gap-2">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabButton>
        <TabButton active={tab === 'risk'} onClick={() => setTab('risk')}>Risk</TabButton>
      </div>

      {tab === 'overview' && (showEmpty ? <EmptyAnalyticsState /> : (
        <>
          <AnalyticsCards />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BuildTimeTrend />
            <CostSavings />
          </div>
          <FlakeyTests />
        </>
      ))}

      {tab === 'risk' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Bus factor = distinct authors in the last 365 days. Files with BF=1 are risky —
            only one person on the team touches them.
          </p>
          <HotspotTable rows={hotspots} loading={loading} />
        </div>
      )}
    </div>
  );
}
