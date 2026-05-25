import { Workflow } from 'lucide-react';

export const metadata = { title: 'Rule Engine' };

export default async function RuleEnginePage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Workflow className="h-6 w-6 text-info" />
        <div>
          <h1 className="text-3xl font-bold text-white">Policy Rule Engine</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage installed rule packs and create custom detection rules
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
          <Workflow className="h-7 w-7 text-neutral-500" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No Rule Packs Yet</h2>
        <p className="text-sm text-neutral-400 max-w-md">
          Deploy an agent to start managing detection rule packs. Rules will appear here automatically.
        </p>
      </div>
    </div>
  );
}
