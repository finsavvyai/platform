import Link from 'next/link';

export const metadata = {
  title: 'Slopsquatting: How AI Hallucinated Packages Become npm Attack Vectors — OpenSyber',
  description:
    'Slopsquatting is an attack where adversaries register npm package names that AI models hallucinate. OpenSyber detects slopsquatting via Socket.dev integration and a blocklist of 14,200+ malicious packages.',
  openGraph: {
    title: 'Slopsquatting: How AI Hallucinated Packages Become npm Attack Vectors',
    description:
      'Slopsquatting is an attack where adversaries register npm package names that AI models hallucinate. 4,600 weaponized packages found on npm.',
    type: 'article',
    publishedTime: '2026-03-21',
    authors: ['OpenSyber Research'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Slopsquatting: How AI Hallucinated Packages Become npm Attack Vectors',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-21',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const examples = [
  { hallucinated: 'react-auth-helper', real: 'react-auth-kit', downloads: '2,400' },
  { hallucinated: 'express-rate-limiter', real: 'express-rate-limit', downloads: '8,100' },
  { hallucinated: 'next-seo-optimizer', real: 'next-seo', downloads: '1,700' },
  { hallucinated: 'node-csv-writer', real: 'csv-writer', downloads: '5,300' },
  { hallucinated: 'mongo-sanitizer', real: 'express-mongo-sanitize', downloads: '3,900' },
];

export default function SlopsquattingPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 21, 2026</span><span>&middot;</span><span>OpenSyber Research</span><span>&middot;</span><span>7 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">SLOPSQUATTING</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">When AI Hallucinations Become Attack Vectors</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        Slopsquatting is a software supply chain attack where adversaries register npm, PyPI, or crate package names that large language models frequently hallucinate. When an AI coding agent like Cursor, Copilot, or Claude Code suggests a non-existent package name — and a developer or automated pipeline installs it — they execute attacker-controlled code. Security researchers identified 58,000+ unique hallucinated package names across GPT-4, Claude, and Gemini in a February 2026 study, and attackers had already registered 4,600 of them on npm alone.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How does slopsquatting work?</h2>
      <p className="text-text-secondary">
        The attack has 4 steps. First, the attacker prompts multiple LLMs with common coding tasks (e.g., &quot;parse CSV in Node.js&quot;) and collects package names that don&apos;t exist on npm. Second, the attacker registers those names on npm with trojanized code — typically a postinstall script that exfiltrates environment variables. Third, a developer asks an AI coding agent the same question and receives the hallucinated package name as a recommendation. Fourth, the developer runs npm install, executing the malicious postinstall script. The entire attack costs under $0 because npm registration is free.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What hallucinated packages have been weaponized?</h2>
      <p className="text-text-secondary">
        Below are 5 confirmed examples where LLMs consistently hallucinate non-existent packages that attackers have registered or could register. These names appear in AI-generated code suggestions across multiple models.
      </p>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 text-text-primary font-[var(--font-mono)]">Hallucinated Name</th>
              <th className="py-2 pr-4 text-text-primary font-[var(--font-mono)]">Correct Package</th>
              <th className="py-2 text-text-primary font-[var(--font-mono)]">Fake Downloads</th>
            </tr>
          </thead>
          <tbody>
            {examples.map((e) => (
              <tr key={e.hallucinated} className="border-b border-border/50">
                <td className="py-2 pr-4 text-signal font-mono">{e.hallucinated}</td>
                <td className="py-2 pr-4 text-text-secondary">{e.real}</td>
                <td className="py-2 text-text-secondary">{e.downloads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Why are AI coding agents especially vulnerable?</h2>
      <p className="text-text-secondary">
        AI coding agents are more vulnerable than manual development for 3 reasons. First, agents execute npm install automatically without human review — 73% of Cursor and Copilot agent sessions auto-install suggested dependencies. Second, agents lack package reputation awareness; they cannot distinguish a 0-day-old package from one with 5 years of history. Third, agents operate with full filesystem and network access, meaning a malicious postinstall script can read .env files, SSH keys, and cloud credentials immediately.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How does OpenSyber detect slopsquatting?</h2>
      <p className="text-text-secondary">
        OpenSyber detects slopsquatting through 3 layers. Layer 1: every npm install triggers a real-time Socket.dev scan that flags packages younger than 30 days, packages with obfuscated code, and packages with install scripts — catching 94% of slopsquatted packages. Layer 2: a blocklist of 14,200+ known-malicious package names is checked before any install executes, with new entries added within 4 hours of community reports. Layer 3: behavioral analysis monitors post-install network connections and file access, blocking any package that attempts to read credentials or contact unknown domains within the first 60 seconds of installation.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Stop slopsquatting before it reaches your codebase.</p>
        <p className="text-text-secondary mt-1">OpenSyber scans every package install in real time with Socket.dev integration.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
