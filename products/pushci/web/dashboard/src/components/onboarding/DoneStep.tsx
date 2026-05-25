import { Link } from 'react-router-dom';
import { btnGesturePrimary } from '../../styles/gestures';
import ConfettiDots from './ConfettiDots';

export default function DoneStep() {
  return (
    <div className="relative text-center space-y-5 animate-scale-in">
      <ConfettiDots />
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <svg aria-hidden="true" className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-100">You're All Set!</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Your CI runs will appear on the Runs page.
          PushCI detects your stack automatically &mdash; no YAML required.
        </p>
      </div>
      <Link
        to="/runs"
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
      >
        View Runs
        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
