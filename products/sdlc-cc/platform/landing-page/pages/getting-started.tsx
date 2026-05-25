import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import AlphaDisclaimer from '../components/AlphaDisclaimer';
import { motion } from 'framer-motion';
import { Code, Terminal, CheckCircle, ArrowRight } from 'lucide-react';

export default function GettingStarted() {
  return (
    <>
      <Head>
        <title>How to Use SDLC.ai | 2-Minute Setup Guide</title>
        <meta name="description" content="Simple proxy setup for compliant AI usage. Change one line of code." />
      </Head>

      <div className="min-h-screen bg-sdlc-dark">
        <Header />

        <main className="max-w-4xl mx-auto px-4 py-16">
          {/* Alpha Disclaimer */}
          <AlphaDisclaimer />

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How to Use SDLC.ai
            </h1>
            <p className="text-xl text-gray-300">
              It&apos;s literally one line of code. Here&apos;s how it works.
            </p>
          </motion.div>

          {/* The Problem */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12 bg-gray-900/50 rounded-lg p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">The Problem</h2>
            <p className="text-gray-300 mb-4">
              Your security team blocks ChatGPT/Claude because developers might paste:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Social Security Numbers (SSN: 123-45-6789)</li>
              <li>Email addresses (john.doe@company.com)</li>
              <li>Credit card numbers</li>
              <li>Patient health information</li>
              <li>Customer data from your database</li>
            </ul>
            <p className="text-gray-300 mt-4">
              Your developers use it anyway (via personal accounts). This creates compliance risk.
            </p>
          </motion.section>

          {/* The Solution */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12 bg-gray-900/50 rounded-lg p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">The Solution</h2>
            <p className="text-gray-300 mb-6">
              SDLC.ai is a proxy that sits between your code and OpenAI/Anthropic/Google:
            </p>

            <div className="bg-black rounded-lg p-4 mb-4 font-mono text-sm">
              <div className="text-gray-500 mb-2"># Before (Direct to OpenAI)</div>
              <div className="text-red-400">OPENAI_API_BASE=https://api.openai.com/v1</div>

              <div className="text-gray-500 mt-4 mb-2"># After (Through SDLC.ai)</div>
              <div className="text-green-400">OPENAI_API_BASE=https://api.sdlc.finsavvyai.com/v1</div>
            </div>

            <p className="text-gray-300">
              That&apos;s it. We automatically:
            </p>
            <ul className="list-none space-y-2 mt-4">
              <li className="flex items-start text-gray-300">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                Detect PII in your requests (SSN, emails, credit cards, PHI)
              </li>
              <li className="flex items-start text-gray-300">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                Replace it with tokens (SSN:123-45-6789 → [SSN_REDACTED_1])
              </li>
              <li className="flex items-start text-gray-300">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                Send clean request to OpenAI/Anthropic
              </li>
              <li className="flex items-start text-gray-300">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                Log everything for compliance audits
              </li>
            </ul>
          </motion.section>

          {/* Step by Step */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-8">Quick Start (2 minutes)</h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-white">Get Your API Key</h3>
                </div>
                <div className="ml-11">
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sign Up Free (No Credit Card) <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                  <p className="text-gray-400 text-sm mt-2">
                    Free tier: 1M tokens/month, all PII detection included
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-white">Update Your Code</h3>
                </div>
                <div className="ml-11">
                  <div className="bg-black rounded-lg p-4 mb-4">
                    <div className="text-gray-500 mb-2"># Python Example</div>
                    <pre className="text-gray-300 text-sm overflow-x-auto">
{`import openai

# Just change the base URL
openai.api_base = "https://api.sdlc.finsavvyai.com/v1"
openai.api_key = "sk-sdlc-your-key-here"

# Everything else stays the same
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Help me with SSN: 123-45-6789"}]
)
# PII is automatically redacted before sending to OpenAI`}
                    </pre>
                  </div>

                  <div className="bg-black rounded-lg p-4">
                    <div className="text-gray-500 mb-2"># JavaScript/TypeScript</div>
                    <pre className="text-gray-300 text-sm overflow-x-auto">
{`import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-sdlc-your-key-here',
  baseURL: 'https://api.sdlc.finsavvyai.com/v1'
});

// Works exactly like OpenAI SDK
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Query with PII' }]
});`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-white">That&apos;s It</h3>
                </div>
                <div className="ml-11">
                  <p className="text-gray-300 mb-4">
                    Your code works exactly the same. Behind the scenes we:
                  </p>
                  <ul className="space-y-2">
                    <li className="text-gray-300">✓ Scan for 12+ PII types</li>
                    <li className="text-gray-300">✓ Redact sensitive data</li>
                    <li className="text-gray-300">✓ Forward to OpenAI/Anthropic</li>
                    <li className="text-gray-300">✓ Log everything for auditors</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* For Investors */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12 bg-blue-900/20 border border-blue-700/50 rounded-lg p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">For Investors: The Business</h2>
            <div className="text-gray-300 space-y-3">
              <p><strong className="text-white">Problem:</strong> Enterprises want AI but security teams block it due to data leaks</p>
              <p><strong className="text-white">Solution:</strong> Drop-in proxy that makes AI providers compliant</p>
              <p><strong className="text-white">Market:</strong> Every company using AI (healthcare, finance, legal all MUST have this)</p>
              <p><strong className="text-white">Pricing:</strong> Free tier → $99/month → Enterprise custom</p>
              <p><strong className="text-white">Competition:</strong> Manual compliance reviews (6-12 months), we do it in real-time</p>
              <p><strong className="text-white">Stage:</strong> Alpha, launching public beta Q2 2026</p>
            </div>
          </motion.section>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Get Started Free <ArrowRight className="ml-2 h-6 w-6" />
            </Link>
            <p className="text-gray-400 mt-4">
              Free forever for developers. No credit card required.
            </p>
          </motion.div>
        </main>
      </div>
    </>
  );
}
