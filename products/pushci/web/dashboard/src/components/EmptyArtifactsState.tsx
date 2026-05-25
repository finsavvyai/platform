import { btnGesturePrimary } from '../styles/gestures';

export default function EmptyArtifactsState() {
  return (
    <div className="max-w-lg mx-auto py-8 sm:py-12 md:py-16 px-4 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100">
          Track build artifacts automatically
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          PushCI captures bundle sizes, test reports, and build outputs from every run.
          See exactly when artifact sizes change and catch regressions early.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-semibold">
            1
          </div>
          <div>
            <p className="text-zinc-200 font-medium text-sm">Connect a runner</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Self-hosted runners publish artifacts from your builds.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-semibold">
            2
          </div>
          <div>
            <p className="text-zinc-200 font-medium text-sm">Push a build</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Artifact sizes are captured and tracked across runs.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-semibold">
            3
          </div>
          <div>
            <p className="text-zinc-200 font-medium text-sm">Spot regressions</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Get alerts when bundle size jumps or test coverage drops.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center space-y-3 pt-2">
        <a
          href="https://pushci.dev/docs#artifacts"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
        >
          Learn About Artifacts
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>
        <p className="text-zinc-600 text-xs">
          Artifact tracking included in all plans. Pro starts at $9/mo.
        </p>
      </div>
    </div>
  );
}
