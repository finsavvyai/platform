import { Crosshair } from 'lucide-react';

export const metadata = { title: 'Kill Chain Correlation' };

export default async function KillChainPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Crosshair className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Kill Chain Correlation</h1>
          <p className="text-sm text-gray-400 mt-1">
            Multi-stage attack pattern detection and correlation
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
          <Crosshair className="h-7 w-7 text-neutral-500" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No Kill Chain Data Yet</h2>
        <p className="text-sm text-neutral-400 max-w-md">
          Deploy an agent to start detecting multi-stage attack patterns. Data will appear here automatically.
        </p>
      </div>
    </div>
  );
}
