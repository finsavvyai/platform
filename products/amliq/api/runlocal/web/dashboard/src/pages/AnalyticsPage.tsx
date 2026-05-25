import AnalyticsCards from '../components/AnalyticsCards';
import BuildTimeTrend from '../components/BuildTimeTrend';
import FlakeyTests from '../components/FlakeyTests';
import CostSavings from '../components/CostSavings';
import PipelineGraph from '../components/PipelineGraph';
import PageHeader from '../components/PageHeader';

const pipelineJobs = [
  { name: 'Checkout', status: 'passed' as const, duration: '2s', dependsOn: [] },
  { name: 'Lint', status: 'passed' as const, duration: '12s', dependsOn: ['Checkout'] },
  { name: 'Test', status: 'running' as const, duration: '24s', dependsOn: ['Checkout'] },
  { name: 'Build', status: 'pending' as const, duration: '—', dependsOn: ['Lint', 'Test'] },
  { name: 'Deploy', status: 'pending' as const, duration: '—', dependsOn: ['Build'] },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Pipeline performance and insights"
      />
      <AnalyticsCards />
      <PipelineGraph jobs={pipelineJobs} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BuildTimeTrend />
        <CostSavings />
      </div>
      <FlakeyTests />
    </div>
  );
}
