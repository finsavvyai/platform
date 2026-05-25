import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';

import LawHeader from '../components/law/LawHeader';
import LawHero from '../components/law/LawHero';
import PlausibleStub from '../components/law/PlausibleStub';

// Below-the-fold sections are dynamically imported to keep the initial
// payload small. None of them depend on browser APIs, so SSR stays on.
const LawWhySelfHost = dynamic(() => import('../components/law/LawWhySelfHost'));
const LawIncluded = dynamic(() => import('../components/law/LawIncluded'));
const LawPrivilege = dynamic(() => import('../components/law/LawPrivilege'));
const LawPricing = dynamic(() => import('../components/law/LawPricing'));
const LawFAQ = dynamic(() => import('../components/law/LawFAQ'));
const LawFooter = dynamic(() => import('../components/law/LawFooter'));

const title =
  'sdlc.cc — Self-hosted privacy gateway for any LLM';
const description =
  'Open-source privacy gateway that scrubs PII and secrets out of every prompt before it reaches ChatGPT, Claude, Gemini, or Copilot. Real Go backend. Browser + IDE + Office addins. AGPL-3.0 with tiered commercial license from $39/seat/mo.';

const HomePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0E1F33" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://sdlc.cc/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />

        <link rel="canonical" href="https://sdlc.cc/" />
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
          <LawHero />
          <LawWhySelfHost />
          <LawIncluded />
          <LawPrivilege />
          <LawPricing />
          <LawFAQ />
        </main>
        <LawFooter />
      </div>
    </>
  );
};

export default HomePage;
