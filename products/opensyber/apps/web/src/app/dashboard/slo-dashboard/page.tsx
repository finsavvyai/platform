import { Gauge } from 'lucide-react';

export const metadata = { title: 'SLO Dashboard' };

export default async function SLODashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Gauge className="h-6 w-6 text-purple-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Integration SLO Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Service level agreement monitoring for critical integrations
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
          <Gauge className="h-7 w-7 text-neutral-500" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No SLO Data Yet</h2>
        <p className="text-sm text-neutral-400 max-w-md">
          Connect your integrations to start tracking service level objectives. Data will appear here automatically.
        </p>
      </div>
    </div>
  );
}
