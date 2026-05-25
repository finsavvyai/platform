import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';

import LawHeader from '../components/law/LawHeader';
import PlausibleStub from '../components/law/PlausibleStub';

const LawPricing = dynamic(() => import('../components/law/LawPricing'));
const LawFooter = dynamic(() => import('../components/law/LawFooter'));

const title = 'Pricing — sdlc.cc privacy gateway';
const description =
  'Free (self-host AGPL-3.0), Team $39/seat/mo, Business $79/seat/mo, Enterprise from $4,000/seat/yr. Same code in every tier — paid tiers lift the AGPL source-disclosure obligation.';

const PricingPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0E1F33" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://sdlc.cc/pricing" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />

        <link rel="canonical" href="https://sdlc.cc/pricing" />
      </Head>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-white focus:text-black focus:rounded"
      >
        Skip to main content
      </a>

      <PlausibleStub />

      <div className="law-theme min-h-screen">
        <LawHeader />
        <main id="main-content">
          <section className="border-b law-rule">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-20 pb-12 md:pt-24">
              <p className="law-cite mb-4">Pricing</p>
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-semibold max-w-3xl leading-[1.1]"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                Same binary in every tier. Pay only to lift the AGPL.
              </h1>
              <p className="mt-5 max-w-2xl text-lg md:text-xl leading-relaxed law-muted">
                The free distribution under AGPL-3.0 is the same code that
                Team, Business, and Enterprise customers run. Paid tiers
                bundle the commercial buyout, support SLA, and (Enterprise)
                negotiable DPA + custom DLP presets + CMEK.
              </p>
            </div>
          </section>

          <LawPricing />

          <section
            id="buy-guide"
            className="border-b law-rule"
            style={{ background: 'var(--law-paper-deep)' }}
          >
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 md:py-20">
              <p className="law-cite mb-3">Section</p>
              <h2
                className="text-2xl md:text-3xl font-semibold max-w-2xl"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                Which tier should you buy?
              </h2>
              <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                <li className="law-card">
                  <h3 className="text-lg font-semibold">Free</h3>
                  <p className="mt-2 text-sm leading-relaxed law-muted">
                    You self-host, your derivatives stay AGPL (or you keep
                    them internal), and you do not need a vendor SLA. Run
                    docker-compose up and you are done.
                  </p>
                </li>
                <li className="law-card">
                  <h3 className="text-lg font-semibold">Team — $39/seat/mo</h3>
                  <p className="mt-2 text-sm leading-relaxed law-muted">
                    You want to embed the gateway in a closed-source product
                    or SaaS without releasing your source under AGPL. 5-seat
                    minimum. Email support.
                  </p>
                </li>
                <li className="law-card">
                  <h3 className="text-lg font-semibold">Business — $79/seat/mo</h3>
                  <p className="mt-2 text-sm leading-relaxed law-muted">
                    You want the browser-store-listed extension builds, SAML
                    + SCIM bundled, a 1-business-day SLA, and the DPA
                    template for your security review. 10-seat minimum.
                  </p>
                </li>
                <li className="law-card">
                  <h3 className="text-lg font-semibold">Enterprise — from $4K/seat/yr</h3>
                  <p className="mt-2 text-sm leading-relaxed law-muted">
                    You need custom DLP presets, a negotiated DPA + MSA, CMEK
                    envelope encryption, a named on-call engineer, and the
                    audit-log retention extensions. Email{' '}
                    <a
                      href="mailto:commercial@sdlc.cc"
                      className="underline"
                      style={{ color: 'var(--law-accent)' }}
                    >
                      commercial@sdlc.cc
                    </a>{' '}
                    to start.
                  </p>
                </li>
              </ul>
            </div>
          </section>

          <section
            id="trust"
            className="border-b law-rule"
          >
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 md:py-20">
              <p className="law-cite mb-3">Trust</p>
              <h2
                className="text-2xl md:text-3xl font-semibold max-w-2xl"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                One Trust Center across three products.
              </h2>
              <p className="mt-4 max-w-2xl law-muted leading-relaxed">
                Every paid tier inherits the same Trust posture. The Trust
                Center covers sdlc-platform plus the two sibling products
                (AMLIQ, Claw) under a single MSA. Sign once, adopt any
                combination.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://trust.sdlc.cc/"
                  className="law-btn-primary"
                  rel="noopener noreferrer"
                  data-plausible-event-name="pricing_trust_center_click"
                >
                  Open Trust Center
                </a>
                <a
                  href="https://github.com/finsavvyai/sdlc-platform/blob/main/COMMERCIAL.md"
                  className="law-btn-secondary"
                  rel="noopener noreferrer"
                  data-plausible-event-name="pricing_commercial_md_click"
                >
                  Read COMMERCIAL.md
                </a>
              </div>
            </div>
          </section>
        </main>
        <LawFooter />
      </div>
    </>
  );
};

export default PricingPage;
