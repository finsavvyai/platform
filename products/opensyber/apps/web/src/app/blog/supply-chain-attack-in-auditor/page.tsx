import Link from 'next/link';

export const metadata = {
  title: 'The Supply Chain Attack Hiding in Your Supply Chain Auditor — OpenSyber',
  description:
    'The Trivy attack spread transitively through setup-trivy. No existing tool scans the full dependency tree of GitHub Actions. SHA pinning the top-level action is not enough.',
  openGraph: {
    title: 'The Supply Chain Attack Hiding in Your Supply Chain Auditor',
    description:
      'GitHub Actions reference other actions via uses: in action.yaml, creating invisible dependency chains. The Trivy compromise spread through setup-trivy and no tool caught it.',
    type: 'article',
    publishedTime: '2026-03-28',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Supply Chain Attack Hiding in Your Supply Chain Auditor',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-28',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const chain = [
  { label: 'Your workflow', detail: 'References trivy-action@v1 to scan container images for vulnerabilities.' },
  { label: 'trivy-action@v1', detail: 'Internally references setup-trivy@v1 in its action.yaml via a uses: directive.' },
  { label: 'setup-trivy@v1', detail: 'Downloads and installs the Trivy binary. When trivy-action was compromised, setup-trivy pulled the malicious binary.' },
  { label: 'Compromised binary', detail: 'The credential-stealing payload (sysmon.py, pgmon) executes inside your CI runner with full access to secrets.' },
];

export default function SupplyChainAuditorPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 28, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>6 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">THE SUPPLY CHAIN ATTACK HIDING IN YOUR SUPPLY CHAIN AUDITOR</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">Transitive Action Dependencies</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        The Trivy attack did not just compromise trivy-action. It spread to setup-trivy as a transitive dependency. No existing tool scanned the full dependency tree of GitHub Actions, and SHA pinning only the top-level action was insufficient to prevent the compromise.
      </p>

      <h2 className="text-2xl font-semibold mt-8">The invisible dependency chain</h2>
      <p className="text-text-secondary">
        GitHub Actions reference other actions in their <code className="text-signal">action.yaml</code> files via <code className="text-signal">uses:</code> directives. This creates dependency chains that are invisible to the workflow author. You pin the top-level action to a SHA, but the actions it depends on may still use mutable tags.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How the Trivy compromise propagated</h2>
      {chain.map((c, i) => (
        <div key={i} className="mt-4 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">{i + 1}.</span> {c.label}
          </h3>
          <p className="text-text-secondary mt-2">{c.detail}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">Why top-level SHA pinning is not enough</h2>
      <p className="text-text-secondary">
        Even if you SHA-pin <code className="text-signal">trivy-action@abc123</code> in your workflow, that pinned version of trivy-action may internally reference <code className="text-signal">setup-trivy@v1</code> using a mutable tag. When the attacker compromises setup-trivy, your pinned trivy-action still pulls the malicious code. The entire dependency tree needs to be resolved and pinned.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber solves this</h2>
      <p className="text-text-secondary">
        OpenSyber&apos;s Transitive Action Scanner resolves the full dependency graph of every GitHub Action in your workflows. It follows <code className="text-signal">uses:</code> references through every <code className="text-signal">action.yaml</code>, identifies mutable tags at any depth, and SHA-pins the entire tree. It is the first product to offer transitive action scanning.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Install the Transitive Action Scanner skill.</p>
        <p className="text-text-secondary mt-1">Resolve the full dependency graph of your GitHub Actions and SHA-pin every transitive dependency.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
