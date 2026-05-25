import { ArrowRight } from 'lucide-react';

const LawHero = () => {
  return (
    <section id="top" className="border-b law-rule">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
        <p
          className="law-cite mb-5"
          aria-label="Open source license"
        >
          AGPL-3.0 / Free, Team, Business, Enterprise tiers
        </p>

        <h1
          className="text-[2.25rem] sm:text-5xl md:text-[3.5rem] leading-[1.08] font-semibold max-w-3xl"
          style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
        >
          Scrub PII and secrets out of every prompt before any LLM sees it.
        </h1>

        <p
          className="mt-6 max-w-2xl text-lg md:text-xl leading-relaxed law-muted"
        >
          sdlc.cc is the privacy gateway for ChatGPT, Claude, Gemini,
          Microsoft Copilot, and your self-hosted models. Real Go backend,
          browser extensions, IDE and Office addins — one policy across
          every surface, with an immutable audit log your security team
          can hand to a regulator unchanged.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href="https://github.com/finsavvyai/sdlc-platform"
            className="law-btn-primary"
            rel="noopener noreferrer"
            data-plausible-event-name="hero_github_click"
          >
            Self-host on GitHub
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a
            href="#pricing"
            className="law-btn-secondary"
            data-plausible-event-name="hero_commercial_click"
          >
            See pricing
          </a>
        </div>

        <dl className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
          <div className="border-l-2 pl-4" style={{ borderColor: 'var(--law-accent)' }}>
            <dt
              className="text-xs uppercase tracking-wider law-muted"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              Where data lives
            </dt>
            <dd className="mt-1 font-semibold">Your network. Your VPC.</dd>
          </div>
          <div className="border-l-2 pl-4" style={{ borderColor: 'var(--law-accent)' }}>
            <dt
              className="text-xs uppercase tracking-wider law-muted"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              License
            </dt>
            <dd className="mt-1 font-semibold">AGPL-3.0 + tiered commercial</dd>
          </div>
          <div className="border-l-2 pl-4" style={{ borderColor: 'var(--law-accent)' }}>
            <dt
              className="text-xs uppercase tracking-wider law-muted"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              Built for
            </dt>
            <dd className="mt-1 font-semibold">Privacy- and compliance-bound teams</dd>
          </div>
        </dl>
      </div>
    </section>
  );
};

export default LawHero;
