import { Link } from 'react-router-dom';
import { Lock, ArrowRight, Video, PlayCircle, FileText } from 'lucide-react';

interface ReleaseGatePageProps {
  feature: string;
}

export default function ReleaseGatePage({ feature }: ReleaseGatePageProps) {
  return (
    <div
      className="min-h-[calc(100vh-100px)] px-6 py-10 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.98))] p-10">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          <Lock className="h-4 w-4" />
          Phase 1 production release
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-white">{feature} is hidden in the current production release.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Qestro is shipping the real workflow first: record flows, turn them into test cases, run them, and sync the resulting assets into Jira.
          This page will return after it has a working backend contract and a clean happy path.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link to="/recording-studio" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 transition hover:border-rose-400/40 hover:bg-rose-400/15">
            <Video className="h-6 w-6 text-rose-300" />
            <div className="mt-4 text-lg font-medium text-white">Recording Studio</div>
            <p className="mt-2 text-sm text-slate-300">Create browser recordings and generate test artifacts.</p>
          </Link>
          <Link to="/runs" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/15">
            <PlayCircle className="h-6 w-6 text-cyan-300" />
            <div className="mt-4 text-lg font-medium text-white">Test Runs</div>
            <p className="mt-2 text-sm text-slate-300">Inspect real execution history and create the next run.</p>
          </Link>
          <Link to="/cases" className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-5 transition hover:border-violet-400/40 hover:bg-violet-400/15">
            <FileText className="h-6 w-6 text-violet-300" />
            <div className="mt-4 text-lg font-medium text-white">Test Cases</div>
            <p className="mt-2 text-sm text-slate-300">Review generated cases and attach them to imported Jira issues.</p>
          </Link>
        </div>

        <Link to="/" className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
          Return to the released product
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
