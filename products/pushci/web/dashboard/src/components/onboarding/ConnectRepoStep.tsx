import { Link } from 'react-router-dom';
import { btnGesturePrimary } from '../../styles/gestures';

const PLATFORMS = ['GitHub', 'GitLab', 'Bitbucket'] as const;

export default function ConnectRepoStep() {
  return (
    <div className="text-center space-y-5 animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <svg aria-hidden="true" className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-100">Connect a Repository</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Link a GitHub, GitLab, or Bitbucket repository.
          PushCI will auto-configure webhooks and detect your stack.
        </p>
      </div>
      <ul className="flex flex-col gap-2 max-w-xs mx-auto">
        {PLATFORMS.map((platform) => (
          <li
            key={platform}
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
          >
            <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold">
              {platform.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-zinc-200">{platform}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/projects"
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
      >
        Go to Projects
        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
