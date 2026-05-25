import { btnGesturePrimary } from '../styles/gestures';

export default function EmptyRunnersState() {
  return (
    <div className="max-w-lg mx-auto py-10 px-4 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100">
          Run CI on your own machines
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          No per-minute billing. No cold starts. Your hardware, your speed.
          Register a runner and builds execute locally in seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">$0</p>
          <p className="text-xs text-zinc-500 mt-0.5">Compute cost</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">&lt;2s</p>
          <p className="text-xs text-zinc-500 mt-0.5">Cold start</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">Any OS</p>
          <p className="text-xs text-zinc-500 mt-0.5">Linux, macOS</p>
        </div>
      </div>

      <div className="text-center space-y-3">
        <a
          href="https://pushci.dev/docs#runners"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
        >
          Runner Setup Guide
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>
        <p className="text-zinc-600 text-xs">
          1 runner free forever. Unlimited runners on Team plans.
        </p>
      </div>
    </div>
  );
}
