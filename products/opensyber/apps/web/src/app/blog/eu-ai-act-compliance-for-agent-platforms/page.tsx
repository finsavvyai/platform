import Link from 'next/link';

export const metadata = {
  title: 'EU AI Act Compliance for Agent Platforms — OpenSyber',
  description:
    'What the EU AI Act means for teams deploying autonomous AI agents in production — risk classification, transparency obligations, and how OpenSyber helps you comply.',
  openGraph: {
    title: 'EU AI Act Compliance for Agent Platforms',
    description:
      'What the EU AI Act means for teams deploying autonomous AI agents in production.',
    type: 'article',
    publishedTime: '2026-03-19',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'EU AI Act Compliance for Agent Platforms',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-19',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

export default function EuAiActPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 19, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>5 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">EU AI ACT COMPLIANCE FOR AGENT PLATFORMS</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">What It Means for AI Agent Deployments</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        The EU AI Act enters enforcement in August 2026. For teams deploying autonomous AI agents, the
        Act introduces risk classification, transparency obligations, and mandatory technical documentation.
        This post explains which requirements apply to AI agent platforms and how OpenSyber helps you comply.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How does the EU AI Act classify AI agents?</h2>
      <p className="text-text-secondary">
        The Act uses a 4-tier risk system: unacceptable, high, limited, and minimal. Most AI coding agents
        fall under &quot;limited risk&quot; because they interact with users and generate content, triggering
        transparency obligations under Article 52. Agents that make autonomous decisions affecting code
        in critical infrastructure (healthcare, finance, energy) may be classified as &quot;high risk&quot;
        under Annex III, requiring conformity assessments and human oversight mechanisms.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What are the transparency requirements?</h2>
      <p className="text-text-secondary">
        Article 52 requires that users are informed when they interact with an AI system. For agent
        platforms, this means: clearly labeling AI-generated code and suggestions, logging all autonomous
        actions taken by agents, and providing mechanisms for users to review and override agent decisions.
        OpenSyber satisfies this through its audit logging system, which records every command, file access,
        and network connection with full attribution.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What technical documentation is required?</h2>
      <p className="text-text-secondary">
        High-risk AI systems must maintain documentation covering: the intended purpose and limitations
        of the system, training data governance, accuracy and robustness metrics, and cybersecurity
        measures. OpenSyber&apos;s compliance dashboard generates audit-ready reports mapping your agent
        configuration against EU AI Act requirements, including evidence of security controls, access
        policies, and monitoring coverage.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What about data governance?</h2>
      <p className="text-text-secondary">
        Article 10 requires appropriate data governance practices for high-risk systems. For AI agents,
        this includes controlling what data the agent can access, ensuring data minimization, and
        maintaining records of data processing activities. OpenSyber enforces deny-by-default file access
        policies and encrypted credential storage, ensuring agents only access explicitly permitted resources.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How does OpenSyber help with compliance?</h2>
      <p className="text-text-secondary">
        OpenSyber provides 4 capabilities that map directly to EU AI Act requirements: audit logging
        for transparency (Article 52), deny-by-default policies for data governance (Article 10),
        the OASF framework for technical documentation (Annex IV), and the compliance dashboard for
        continuous conformity monitoring. The compliance dashboard shows which EU AI Act controls your
        agents satisfy and generates exportable PDF reports for regulators.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Prepare for EU AI Act enforcement.</p>
        <p className="text-text-secondary mt-1">Run a compliance assessment on your agents today.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
