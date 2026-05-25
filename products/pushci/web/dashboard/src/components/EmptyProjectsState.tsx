import { btnGesturePrimary } from '../styles/gestures';

export default function EmptyProjectsState() {
  return (
    <div className="max-w-lg mx-auto py-10 px-4 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100">
          Connect your first repository
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          PushCI works with GitHub, GitLab, and Bitbucket.
          Connect a repo above to get webhook secrets, access control,
          and deployment governance out of the box.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-4 items-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold">
            GH
          </div>
          <div>
            <p className="text-zinc-200 text-sm font-medium">GitHub</p>
            <p className="text-zinc-500 text-xs">Webhooks, commit status, PR checks</p>
          </div>
        </div>
        <div className="flex gap-4 items-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold">
            GL
          </div>
          <div>
            <p className="text-zinc-200 text-sm font-medium">GitLab</p>
            <p className="text-zinc-500 text-xs">Pipeline triggers, merge request integration</p>
          </div>
        </div>
        <div className="flex gap-4 items-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold">
            BB
          </div>
          <div>
            <p className="text-zinc-200 text-sm font-medium">Bitbucket</p>
            <p className="text-zinc-500 text-xs">Build status, pull request integration</p>
          </div>
        </div>
      </div>

      <div className="text-center space-y-3 pt-2">
        <a
          href="https://pushci.dev/docs"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
        >
          Read the Quickstart Guide
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>
        <p className="text-zinc-600 text-xs">
          Free for individuals. Pro plans start at $9/mo.
        </p>
      </div>
    </div>
  );
}
