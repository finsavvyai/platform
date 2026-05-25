import Link from 'next/link';
import { catches, limitations } from './post-data';

export const metadata = {
  title: 'Show HN: PushCI — Catch broken AI-generated code before production',
  description:
    'PushCI is a GitHub Action that validates AI-written PRs with semantic analysis, dependency safety checks, and infrastructure drift detection. Free for open source.',
  openGraph: {
    title: 'Show HN: PushCI — Catch broken AI-generated code before production',
    description:
      'Cursor PRs, Claude-generated migrations, hallucinated infra changes — PushCI catches them before production.',
    type: 'article',
    publishedTime: '2026-05-23',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Show HN: PushCI — Catch broken AI-generated code before production',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-05-23',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

export default function PushCILaunchPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>May 23, 2026</span>
        <span>&middot;</span>
        <span>OpenSyber Team</span>
        <span>&middot;</span>
        <span>6 min read</span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight">
        Show HN: PushCI — Catch broken AI-generated code before production
      </h1>
      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold mt-8">The problem</h2>
      <p className="text-text-secondary">
        We build OpenSyber, a security platform for AI agents. Our codebase has 31K TypeScript files,
        103 database tables, and 263 API routes. About 60% of our PRs now contain AI-generated code
        from Cursor, Claude Code, or Copilot. And we keep finding the same failure modes.
      </p>
      <p className="text-text-secondary">
        The AI writes code that looks correct but is not. It imports modules that do not exist.
        It calls API methods that were removed two versions ago. It adds database columns without
        defaults and breaks every downstream service. It installs packages that were registered
        by attackers under typosquatted names. It generates Terraform with iam:* permissions
        because the docs example used them. These are not hypotheticals. We caught all of these
        in the last 3 months.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What PushCI does</h2>
      <p className="text-text-secondary">
        PushCI is a GitHub Action that runs on every PR. It does three things:
      </p>
      <p className="text-text-secondary">
        <strong className="text-white">Semantic validation</strong> — not syntax checking, semantic
        checking. PushCI resolves every import, function call, and type reference in the diff against
        the actual codebase. If the AI hallucinated a module or called a function that does not exist,
        PushCI flags it inline on the PR. It also checks schema changes against downstream consumers
        to catch breaking migrations.
      </p>
      <p className="text-text-secondary">
        <strong className="text-white">Dependency safety</strong> — every new or changed dependency
        is checked against typosquat databases, known-vulnerability feeds, and package age heuristics.
        A package registered 3 days ago with an install script that reads .env is blocked before it
        reaches your lockfile.
      </p>
      <p className="text-text-secondary">
        <strong className="text-white">Infrastructure drift</strong> — Terraform, Kubernetes, and
        Docker configs in the PR are compared against your declared baseline. PushCI catches
        overly permissive IAM, missing resource limits, public-facing services that should be
        internal, and images pinned to mutable tags.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How it works</h2>
      <p className="text-text-secondary">Two lines in your GitHub Actions workflow:</p>
      <pre className="bg-panel rounded border border-border p-4 text-sm font-mono text-text-primary overflow-x-auto mt-4">
{`- name: PushCI
  uses: opensyber/pushci@v1`}
      </pre>
      <p className="text-text-secondary mt-4">
        That is the entire setup. PushCI runs on every PR, annotates findings inline, and exits with
        a pass, warn, or block status. Median check time is 340ms. Average false positive rate is
        0.3 per repo per day.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What it catches that linters do not</h2>
      <ul className="space-y-2 text-text-secondary">
        {catches.map((item) => (
          <li key={item.slice(0, 40)}>{item}</li>
        ))}
      </ul>

      <h2 className="text-2xl font-semibold mt-8">Honest limitations</h2>
      <ul className="space-y-2 text-text-secondary">
        {limitations.map((item) => (
          <li key={item.slice(0, 40)}>{item}</li>
        ))}
      </ul>

      <h2 className="text-2xl font-semibold mt-8">Pricing</h2>
      <p className="text-text-secondary">
        Free for open source. For private repos, free up to 100 checks per month, then $29/month
        for unlimited. We would rather every open source repo have this than optimize for revenue
        on day one.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">
          Try PushCI on your next AI-generated PR.
        </p>
        <p className="text-text-secondary mt-1">
          Landing page with more detail:{' '}
          <Link href="/pushci" className="text-signal underline">/pushci</Link>
        </p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">
          Add to your repo &rarr;
        </Link>
      </div>
    </article>
  );
}
