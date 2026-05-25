type QA = { q: string; a: React.ReactNode };

const faqs: QA[] = [
  {
    q: 'Why AGPL-3.0 and not MIT or Apache-2.0?',
    a: (
      <>
        AGPL keeps the project genuinely open: if a competitor offers sdlc.cc
        as a hosted service to other firms, they must publish their changes.
        That obligation is what funds continued open-source development. Firms
        running sdlc.cc internally for their own attorneys are unaffected.
      </>
    ),
  },
  {
    q: 'Can we fork or modify the code?',
    a: (
      <>
        Yes. Both the AGPL-3.0 and the commercial license grant full rights to
        modify, fork, and redistribute. Patches contributed back are reviewed
        like any other contribution.
      </>
    ),
  },
  {
    q: 'What exactly does the $4K/seat commercial license grant?',
    a: (
      <>
        It grants the right to use sdlc.cc in production without triggering
        AGPL-3.0’s source-disclosure clause. It also covers indemnification
        for IP claims against the project and a 1-business-day support SLA.
        Full terms in <code>COMMERCIAL.md</code>.
      </>
    ),
  },
  {
    q: 'Do you offer HIPAA or SOC 2 attestations?',
    a: (
      <>
        sdlc.cc is a self-hosted gateway, so attestations apply to your
        deployment, not to us. The codebase ships with the controls needed to
        operate inside a HIPAA or SOC 2 environment: encryption-at-rest hooks,
        audit logs, RBAC, and BAA-compatible logging. We will participate in
        your auditor questionnaires.
      </>
    ),
  },
  {
    q: 'Can we evaluate before we buy?',
    a: (
      <>
        Yes. Clone the repository under AGPL-3.0 and run it on a staging
        cluster as long as you like. Buy the commercial license only when you
        decide to run it in production under your firm’s proprietary stack.
      </>
    ),
  },
  {
    q: 'Do you offer a SaaS version?',
    a: (
      <>
        No. A hosted SaaS would defeat the privilege-protection argument that
        is the reason this product exists. If a vendor holds your client data,
        you have a vendor-subpoena problem the gateway cannot solve.
      </>
    ),
  },
  {
    q: 'What if our state bar opinion conflicts with the included DLP preset?',
    a: (
      <>
        The preset is a YAML file. Fork it. The repository ships an example
        override at <code>policies/legal/state-bar-override.example.yaml</code>.
        Your general counsel reviews the diff like any other policy change.
      </>
    ),
  },
  {
    q: 'How does the gateway handle vendor outages?',
    a: (
      <>
        Multi-provider routing falls back across Anthropic, OpenAI, Bedrock,
        Vertex, and Azure in the order you configure. Per-tenant spend caps
        and circuit breakers prevent a runaway model from exhausting a budget
        during a fallback storm.
      </>
    ),
  },
  {
    q: 'Who owns the data in the audit log?',
    a: (
      <>
        Your firm. The log writes to your Postgres or S3 bucket. We never see
        it. The HMAC chain key is generated on first run and stored only on
        your side — we cannot decrypt or alter your log even if we wanted to.
      </>
    ),
  },
  {
    q: 'How do we get support?',
    a: (
      <>
        Commercial-license customers email{' '}
        <a href="mailto:commercial@sdlc.cc" className="underline">
          commercial@sdlc.cc
        </a>{' '}
        for licensing and{' '}
        <a href="mailto:hello@sdlc.cc" className="underline">
          hello@sdlc.cc
        </a>{' '}
        for general questions. AGPL users open GitHub issues — we triage them
        on the same board as paying customers, but paying customers get SLA.
      </>
    ),
  },
];

const LawFAQ = () => {
  return (
    <section id="faq" className="border-b law-rule">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
        <p className="law-cite mb-3">Section 05</p>
        <h2
          className="text-3xl md:text-4xl font-semibold max-w-2xl"
          style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
        >
          Questions general counsel asks first.
        </h2>

        <dl className="mt-10 max-w-3xl">
          {faqs.map(({ q, a }, i) => (
            <details
              key={q}
              className="border-b law-rule py-5 group"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary
                className="cursor-pointer list-none flex items-start justify-between gap-4"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                <span className="font-semibold text-base md:text-lg">{q}</span>
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 transition-transform group-open:rotate-45 text-2xl leading-none law-muted"
                  style={{ marginTop: '-2px' }}
                >
                  +
                </span>
              </summary>
              <dd className="mt-3 text-sm md:text-base law-muted leading-relaxed">
                {a}
              </dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default LawFAQ;
