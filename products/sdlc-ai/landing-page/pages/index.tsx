import type { NextPage } from 'next';
import Head from 'next/head';
import Header from '../components/Header';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import DemoForm from '../components/DemoForm';

const HomePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>OpenSyber | Wild AI Velocity, Controlled Risk</title>
        <meta
          name="description"
          content="OpenSyber secures AI production flows with real-time policy enforcement, prompt shielding, and audit-grade governance for regulated teams."
        />
        <meta
          name="keywords"
          content="AI security platform, enterprise AI compliance, prompt injection defense, data loss prevention AI, model governance, secure AI gateway"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://opensyber.ai/" />
        <meta property="og:title" content="OpenSyber | Wild AI Velocity, Controlled Risk" />
        <meta
          property="og:description"
          content="Ship AI aggressively while OpenSyber enforces policy, protects sensitive data, and signs every decision for compliance."
        />
        <meta property="og:image" content="https://opensyber.ai/og-image.png" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://opensyber.ai/" />
        <meta property="twitter:title" content="OpenSyber | AI Security Fabric for Production" />
        <meta
          property="twitter:description"
          content="OpenSyber makes enterprise AI safe by default with runtime policy controls and evidence-grade audit trails."
        />
        <meta property="twitter:image" content="https://opensyber.ai/twitter-image.png" />

        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
        <link rel="canonical" href="https://opensyber.ai/" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'OpenSyber',
              description: 'AI security fabric with runtime governance, DLP, policy enforcement, and auditable control evidence.',
              url: 'https://opensyber.ai/',
              applicationCategory: 'SecurityApplication',
              operatingSystem: 'Cloud',
              offers: {
                '@type': 'Offer',
                price: '2400',
                priceCurrency: 'USD',
                priceValidUntil: '2027-12-31',
                availability: 'https://schema.org/InStock',
                description: 'Monthly subscription for OpenSyber Pilot plan'
              },
              creator: {
                '@type': 'Organization',
                name: 'OpenSyber',
                url: 'https://opensyber.ai/'
              }
            })
          }}
        />
      </Head>

      <div className="min-h-screen bg-sdlc-dark">
        <Header />
        <Hero />
        <Features />
        <Pricing />
        <DemoForm />

        <footer className="bg-[#03060d]/70 border-t border-slate-800 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-sdlc-blue to-sdlc-accent rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">OS</span>
                  </div>
                  <span className="text-xl font-bold text-white">OpenSyber</span>
                </div>
                <p className="text-slate-400 mb-4 max-w-md">
                  OpenSyber is the AI control plane for ambitious teams shipping into regulated,
                  customer-facing, high-risk workflows.
                </p>
                <div className="flex space-x-4">
                  <div className="flex items-center text-sm text-slate-500">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                    SOC 2 Type II
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                    GDPR Policy Packs
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                    HIPAA Controls
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Product</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="#security" className="text-slate-400 hover:text-white transition-colors">
                      Model Coverage
                    </a>
                  </li>
                  <li>
                    <a href="#features" className="text-slate-400 hover:text-white transition-colors">
                      Runtime Control Flow
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="text-slate-400 hover:text-white transition-colors">
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#demo" className="text-slate-400 hover:text-white transition-colors">
                      Trust Signals
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">Legal</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="/terms" className="text-slate-400 hover:text-white transition-colors">
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="/compliance" className="text-slate-400 hover:text-white transition-colors">
                      Compliance
                    </a>
                  </li>
                  <li>
                    <a href="/security" className="text-slate-400 hover:text-white transition-colors">
                      Security
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-800 mt-12 pt-8">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <p className="text-slate-400 text-sm">
                  © 2026 OpenSyber. All rights reserved.
                </p>
                <div className="flex space-x-6 mt-4 md:mt-0">
                  <a href="mailto:security@opensyber.ai" className="text-slate-400 hover:text-white text-sm transition-colors">
                    Security Team
                  </a>
                  <a href="mailto:support@opensyber.ai" className="text-slate-400 hover:text-white text-sm transition-colors">
                    Support
                  </a>
                  <a href="mailto:sales@opensyber.ai" className="text-slate-400 hover:text-white text-sm transition-colors">
                    Sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
