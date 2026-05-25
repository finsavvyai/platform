import RunnerFleet from '../components/RunnerFleet';
import PageHeader from '../components/PageHeader';

// Token is fetched from the API; displayed as masked until loaded.
const MASKED_TOKEN = '••••••••••••••••••••';

export default function RunnersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Runners"
        description="Manage your self-hosted runner fleet"
      />
      <RunnerFleet />

      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Register New Runner</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Run this command on the machine you want to use as a runner.
        </p>
        <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm text-emerald-400
          border border-zinc-800 overflow-x-auto">
          pushci agent --token={MASKED_TOKEN}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => alert('Generate a token via "Regenerate Token" first')}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400
              hover:bg-emerald-500/20 transition-colors font-medium"
          >
            Copy Command
          </button>
          <button className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300
            hover:bg-zinc-700 transition-colors font-medium">
            Regenerate Token
          </button>
        </div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Requirements</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Linux (x64/arm64) or macOS (Apple Silicon)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Docker installed (optional, for container-based builds)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Outbound HTTPS access to api.pushci.dev
          </li>
        </ul>
      </div>
    </div>
  );
}
