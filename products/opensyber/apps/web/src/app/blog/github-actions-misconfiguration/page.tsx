import Link from 'next/link';

export const metadata = {
  title: 'The One GitHub Actions Misconfiguration Behind Every Major Supply Chain Attack — OpenSyber',
  description:
    'Six major supply chain incidents share the same root cause: pull_request_target running fork PR code with parent repo secrets. A technical breakdown with safe alternatives.',
  openGraph: {
    title: 'The One GitHub Actions Misconfiguration Behind Every Major Supply Chain Attack',
    description:
      'Trivy, tj-actions, Ultralytics, Cline, Checkmarx, ambient-code — all exploited via pull_request_target. Here is the fix.',
    type: 'article',
    publishedTime: '2026-03-28',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The One GitHub Actions Misconfiguration Behind Every Major Supply Chain Attack',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-28',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const incidents = [
  { name: 'Trivy (Aqua Security)', what: 'Fork PR triggered a workflow that exposed container registry credentials via pull_request_target.' },
  { name: 'tj-actions/changed-files', what: 'Compromised action tag injected a credential-harvesting step into thousands of downstream workflows.' },
  { name: 'Ultralytics', what: 'Fork PR ran untrusted code in a privileged workflow context, leaking PyPI publishing tokens.' },
  { name: 'Cline (VS Code Extension)', what: 'Pull request from a fork executed build scripts with access to the extension marketplace signing key.' },
  { name: 'Checkmarx', what: 'CI workflow ran fork-submitted test code that exfiltrated environment secrets to an external endpoint.' },
  { name: 'ambient-code', what: 'A fork PR modified the build script, which ran with elevated permissions and leaked API tokens.' },
];

export default function GitHubActionsMisconfigPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 28, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>8 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">THE ONE GITHUB ACTIONS MISCONFIGURATION</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">Behind Every Major Supply Chain Attack</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        Six major supply chain incidents in the past year share the same root cause: a GitHub Actions workflow using <code className="text-text-primary">pull_request_target</code> that runs fork PR code with access to the parent repository&apos;s secrets. The pattern is identical every time, and it is still the most common misconfiguration in open source CI/CD.
      </p>

      <h2 className="text-2xl font-semibold mt-8">The dangerous pattern</h2>
      <div className="mt-4 rounded-2xl border border-red-500/30 bg-panel/50 p-5">
        <p className="text-xs text-red-400 font-[var(--font-mono)] uppercase tracking-widest mb-2">Dangerous — do not use</p>
        <pre className="text-sm text-text-secondary overflow-x-auto"><code>{`on:
  pull_request_target:
    types: [opened, synchronize]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: npm test  # Runs fork code with repo secrets`}</code></pre>
      </div>

      <h2 className="text-2xl font-semibold mt-8">The safe pattern</h2>
      <div className="mt-4 rounded-2xl border border-signal/30 bg-panel/50 p-5">
        <p className="text-xs text-signal font-[var(--font-mono)] uppercase tracking-widest mb-2">Safe — use this instead</p>
        <pre className="text-sm text-text-secondary overflow-x-auto"><code>{`on:
  pull_request:  # Not pull_request_target
    types: [opened, synchronize]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test  # Runs in fork context, no secrets`}</code></pre>
      </div>

      <h2 className="text-2xl font-semibold mt-8">6 incidents, same root cause</h2>
      {incidents.map((inc, i) => (
        <div key={i} className="mt-4 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">{i + 1}.</span> {inc.name}
          </h3>
          <p className="text-text-secondary mt-2">{inc.what}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber prevents this</h2>
      <p className="text-text-secondary">
        The <strong className="text-text-primary">Workflow Trigger Auditor</strong> skill scans every GitHub Actions workflow file in your repository and flags any use of <code className="text-text-primary">pull_request_target</code> that checks out fork code. It runs on every push and PR, providing immediate feedback before the misconfiguration reaches production. Combined with the CI/CD Supply Chain Guardian, it covers the full spectrum of workflow-level supply chain risks.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Audit your workflows before attackers do.</p>
        <p className="text-text-secondary mt-1">Install the Workflow Trigger Auditor from the OpenSyber Skill Marketplace.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
