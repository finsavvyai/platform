import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Download, Terminal, CheckCircle, ArrowRight, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Install OpenAgent — Free VS Code Extension | OpenSyber',
  description:
    'Install the OpenAgent VS Code extension in 60 seconds. Monitor every file and command your AI coding agent touches.',
};

const VSIX_URL = 'https://pub-assets.opensyber.cloud/opensyber-openagent-0.1.0.vsix';

const STEPS = [
  {
    n: '1',
    icon: Download,
    title: 'Download the extension',
    body: 'Click the button below to download the .vsix installer file.',
    code: null,
  },
  {
    n: '2',
    icon: Terminal,
    title: 'Install via VS Code CLI',
    body: 'Open your terminal and run:',
    code: 'code --install-extension opensyber-openagent-0.1.0.vsix',
  },
  {
    n: '3',
    icon: CheckCircle,
    title: 'Reload VS Code',
    body: 'Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux), then run:',
    code: 'Developer: Reload Window',
  },
  {
    n: '4',
    icon: Shield,
    title: 'Start monitoring',
    body: 'The OpenAgent panel appears in the VS Code sidebar. Use Cursor, Cline, or any AI agent — activity shows up in real time.',
    code: null,
  },
];

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-void text-neutral-100">
      <SiteHeader />

      <section className="mx-auto max-w-2xl px-6 pt-24 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-info/30 bg-signal/10 px-4 py-1.5 text-xs font-semibold text-signal uppercase tracking-wider">
          Free · No account required
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-4">
          Install OpenAgent
        </h1>
        <p className="text-lg text-text-secondary mb-10">
          Up and running in 60 seconds. Works with Cursor, Cline, Claude Code, GitHub Copilot.
        </p>

        <a
          href={VSIX_URL}
          download
          className="inline-flex items-center gap-3 rounded bg-signal px-10 py-4 text-base font-bold hover:bg-signal-hover transition"
        >
          <Download className="h-5 w-5" />
          Download opensyber-openagent-0.1.0.vsix
        </a>
        <p className="mt-3 text-xs text-text-dim">
          VS Code 1.85+ · macOS, Linux, Windows · ~350 KB
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-24">
        <div className="space-y-4">
          {STEPS.map(({ n, icon: Icon, title, body, code }) => (
            <div key={n} className="rounded border border-border bg-panel/30 p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-signal/20 text-sm font-bold text-signal">
                  {n}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-signal" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
                  {code && (
                    <code className="mt-2 block rounded-lg border border-border bg-void px-4 py-2.5 text-xs font-mono text-green-400 break-all">
                      {code}
                    </code>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-32">
        <div className="rounded border border-border bg-panel/30 p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Extension installed?</h2>
          <p className="text-sm text-text-secondary mb-6">
            Open any project in VS Code and let your AI agent run. Come back here to view your activity dashboard.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 rounded bg-signal px-6 py-3 text-sm font-bold hover:bg-signal-hover transition"
            >
              Get cloud dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/openagent"
              className="flex items-center gap-2 rounded border border-wire bg-surface px-6 py-3 text-sm font-semibold hover:bg-neutral-700 transition"
            >
              Back to OpenAgent
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
