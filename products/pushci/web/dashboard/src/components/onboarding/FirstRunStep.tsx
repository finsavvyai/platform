export default function FirstRunStep() {
  return (
    <div className="text-center space-y-5 animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <svg aria-hidden="true" className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-100">Trigger Your First Run</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Initialize PushCI in your project, then push a commit to
          trigger your first CI run automatically.
        </p>
      </div>
      <div className="max-w-sm mx-auto space-y-3 text-left">
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Option A &mdash; CLI
          </span>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 font-mono text-sm text-emerald-400">
            <span aria-hidden="true" className="text-zinc-500 select-none">$</span>
            <code className="select-all">npx pushci init</code>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Option B &mdash; Git Push
          </span>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 font-mono text-sm text-emerald-400">
            <span aria-hidden="true" className="text-zinc-500 select-none">$</span>
            <code className="select-all">git push origin main</code>
          </div>
        </div>
      </div>
      <p className="text-zinc-500 text-xs max-w-xs mx-auto">
        The pre-push hook runs your tests locally. The webhook
        reports results to the dashboard.
      </p>
    </div>
  );
}
