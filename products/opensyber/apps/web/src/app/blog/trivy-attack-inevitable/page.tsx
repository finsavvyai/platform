import Link from 'next/link';

export const metadata = {
  title: 'The Trivy Attack Was Inevitable — OpenSyber',
  description:
    'On March 19, 2026, TeamPCP force-pushed a malicious commit to Trivy GitHub Action. The 12-hour blast radius exposed every CI pipeline using trivy-action. Mutable tags are broken by design.',
  openGraph: {
    title: 'The Trivy Attack Was Inevitable',
    description:
      'TeamPCP compromised Trivy GitHub Action via force-push. 12-hour blast radius, transitive spread to setup-trivy, and stolen VS Code extension tokens. SHA pinning is the only defense.',
    type: 'article',
    publishedTime: '2026-03-27',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Trivy Attack Was Inevitable',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-27',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const timeline = [
  { time: 'Friday 5:00 PM UTC', event: 'TeamPCP force-pushed a malicious commit to the trivy-action GitHub Action tag.' },
  { time: 'Friday 5:01 PM UTC', event: 'Every CI pipeline referencing trivy-action by mutable tag began downloading the compromised version.' },
  { time: 'Friday ~5:30 PM UTC', event: 'The payload replaced the Trivy binary with credential-stealing scripts (sysmon.py, pgmon).' },
  { time: 'Saturday ~5:00 AM UTC', event: 'Community detection after approximately 12 hours of uninterrupted exfiltration.' },
];

export default function TrivyAttackPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 27, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>7 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">THE TRIVY ATTACK WAS INEVITABLE</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">Mutable Tags Are Broken by Design</p>
      <hr className="border-border/50 my-8" />

      <p className="text-text-secondary text-lg">
        On March 19, 2026, at Friday 5 PM UTC, TeamPCP force-pushed a malicious commit to the Trivy GitHub Action tag. The attack replaced the legitimate Trivy binary with a credential-stealing payload. For 12 hours, every CI pipeline running trivy-action downloaded the backdoor.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Timeline</h2>
      {timeline.map((t, i) => (
        <div key={i} className="mt-4 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">{t.time}</span>
          </h3>
          <p className="text-text-secondary mt-2">{t.event}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">How the payload worked</h2>
      <p className="text-text-secondary">
        The malicious commit replaced the Trivy binary with two credential-stealing scripts: sysmon.py and pgmon. These scripts harvested CI environment variables, secrets, and tokens, then exfiltrated them to an attacker-controlled C2 domain via outbound HTTP requests.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Transitive spread</h2>
      <p className="text-text-secondary">
        The attack did not stop at trivy-action. Because setup-trivy referenced trivy-action as a dependency, the compromise spread transitively. Any workflow using setup-trivy was also affected. Additionally, stolen publish tokens were used to push compromised versions of VS Code extensions to both the VS Code Marketplace and OpenVSX.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Why mutable tags are broken by design</h2>
      <p className="text-text-secondary">
        GitHub Actions tags like <code className="text-signal">@v1</code> are mutable references. Anyone with write access can force-push a new commit to the same tag. There is no integrity verification, no content hash check, and no notification to downstream consumers. SHA pinning is the only defense because it references an immutable commit hash that cannot be silently replaced.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber detects this</h2>
      <p className="text-text-secondary">
        OpenSyber&apos;s CI/CD Supply Chain Guardian already SHA-pins all GitHub Actions and detects when a mutable tag resolves to a different commit than expected. The Network Sentinel would have caught the outbound curl to the C2 domain, triggering an immediate alert before any secrets left the pipeline.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Install the CI/CD Supply Chain Guardian skill.</p>
        <p className="text-text-secondary mt-1">SHA-pin your GitHub Actions, detect mutable tag changes, and block credential exfiltration before it happens.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
