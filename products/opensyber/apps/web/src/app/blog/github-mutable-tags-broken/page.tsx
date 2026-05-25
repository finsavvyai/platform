import Link from 'next/link';

export const metadata = {
  title: 'GitHub Finally Admits Mutable Tags Are Broken — OpenSyber',
  description:
    'GitHub announced a security roadmap with lockfiles for workflow dependencies, immutable releases, and egress policy. But it is a roadmap, not shipped. OpenSyber ships SHA pinning today.',
  openGraph: {
    title: 'GitHub Finally Admits Mutable Tags Are Broken',
    description:
      'GitHub announced lockfiles, immutable releases, and egress policy for Actions. OpenSyber ships SHA pinning and egress controls today.',
    type: 'article',
    publishedTime: '2026-03-28',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'GitHub Finally Admits Mutable Tags Are Broken',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-28',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const comparison = [
  { feature: 'Workflow dependency lockfile', github: 'Announced, not shipped', opensyber: 'CI/CD Supply Chain Guardian pins all action refs to SHA today' },
  { feature: 'Immutable releases', github: 'Announced, not shipped', opensyber: 'SHA pinning enforced on every workflow scan — mutable tags flagged immediately' },
  { feature: 'Egress policy for runners', github: 'Announced, not shipped', opensyber: 'Agent containers enforce deny-by-default egress with allowlist configuration' },
  { feature: 'Action provenance verification', github: 'Partial (Sigstore for select actions)', opensyber: 'Supply Chain Guardian verifies provenance metadata on every action reference' },
  { feature: 'Fork PR secret isolation', github: 'Exists but misconfigured in most repos', opensyber: 'Workflow Trigger Auditor flags pull_request_target misconfigurations' },
];

export default function GitHubMutableTagsPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 28, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>6 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">GITHUB FINALLY ADMITS MUTABLE TAGS ARE BROKEN</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">Roadmap vs Reality</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        GitHub&apos;s 2026 security roadmap acknowledges what the security community has been saying for years: mutable tags on GitHub Actions are a supply chain risk. GitHub announced lockfiles for workflow dependencies, immutable releases, and egress policy for runners. These are the right features. The problem is that they are a roadmap, not shipped product.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What GitHub announced</h2>
      <p className="text-text-secondary">
        GitHub&apos;s roadmap includes three key security features: a lockfile mechanism for workflow dependencies that pins action versions at install time, immutable release artifacts that prevent tag mutation after publication, and an egress policy for GitHub-hosted runners that restricts outbound network access. Each of these addresses a real attack vector that has been exploited in production incidents.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Why a roadmap is not enough</h2>
      <p className="text-text-secondary">
        The tj-actions/changed-files incident compromised thousands of repositories because a mutable tag was poisoned. That happened while these features were on the roadmap. Every day between announcement and shipment is a day your workflows are unprotected. Roadmaps do not stop supply chain attacks. Shipped tooling does.
      </p>

      <h2 className="text-2xl font-semibold mt-8">GitHub roadmap vs OpenSyber today</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 pr-4 text-text-primary font-semibold">Feature</th>
              <th className="py-3 pr-4 text-text-dim font-semibold">GitHub</th>
              <th className="py-3 text-signal font-semibold">OpenSyber</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-3 pr-4 text-text-primary">{row.feature}</td>
                <td className="py-3 pr-4 text-text-secondary">{row.github}</td>
                <td className="py-3 text-text-secondary">{row.opensyber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-8">What you should do now</h2>
      <p className="text-text-secondary">
        Do not wait for GitHub to ship. Pin every action reference to a full SHA commit hash today. Use the CI/CD Supply Chain Guardian to scan your repositories and automatically flag any workflow that references a mutable tag. When GitHub ships their lockfile feature, it will complement what you already have in place.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Ship SHA pinning today, not when GitHub gets around to it.</p>
        <p className="text-text-secondary mt-1">The CI/CD Supply Chain Guardian scans and pins every action reference in your workflows.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
