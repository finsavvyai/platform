import Link from 'next/link';

export const metadata = {
  title: 'Your AI Code Reviewer Can Be Hacked With a GitHub Issue — OpenSyber',
  description:
    'AI-powered GitHub Actions process untrusted input from issues and PRs. The Clinejection and PromptPwnd attacks show how attackers exploit this to steal tokens and API keys.',
  openGraph: {
    title: 'Your AI Code Reviewer Can Be Hacked With a GitHub Issue',
    description:
      'Clinejection exposed npm tokens via a poisoned GitHub issue. PromptPwnd hit 5 Fortune 500 companies through Gemini CLI. The fix: validate AI action configs and scan instruction files.',
    type: 'article',
    publishedTime: '2026-03-28',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Your AI Code Reviewer Can Be Hacked With a GitHub Issue',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-28',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const attacks = [
  {
    name: 'Clinejection',
    detail: 'A GitHub issue containing hidden instructions caused Cline\'s AI bot to expose npm publish tokens. The attacker used the stolen tokens to publish cline@2.3.0 with a malicious postinstall script, affecting over 5 million users who installed or updated the package.',
  },
  {
    name: 'PromptPwnd',
    detail: 'Five Fortune 500 companies were hit when attackers submitted GitHub issues containing prompt injection payloads targeting AI-powered code review workflows. Google\'s own Gemini CLI workflow leaked API keys after processing a malicious issue body.',
  },
];

export default function AICodeReviewerPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 28, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>8 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">YOUR AI CODE REVIEWER CAN BE HACKED WITH A GITHUB ISSUE</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">PromptPwnd + Clinejection</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        AI-powered GitHub Actions such as Claude Code Actions, Gemini CLI, and OpenAI Codex process untrusted user input from issue bodies and PR descriptions. Attackers have discovered that embedding prompt injection payloads in these inputs can hijack the AI agent, causing it to leak secrets, publish malicious packages, or exfiltrate credentials.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Two attacks, one pattern</h2>
      {attacks.map((a, i) => (
        <div key={i} className="mt-4 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">{i + 1}.</span> {a.name}
          </h3>
          <p className="text-text-secondary mt-2">{a.detail}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">The common pattern</h2>
      <p className="text-text-secondary">
        In both cases, untrusted input from a GitHub issue body or PR description flowed directly into an AI agent prompt. The AI agent treated the injected instructions as legitimate commands. The attacker never needed repository write access, a compromised account, or a zero-day vulnerability. They only needed to open an issue.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Why existing defenses fail</h2>
      <p className="text-text-secondary">
        Traditional CI/CD security tools scan for secrets in code, not for prompt injection in issue bodies. SAST tools do not analyze AI action configurations. Code review bots do not validate the <code className="text-signal">allowed_non_write_users</code> field or scan instruction files for hidden directives. The attack surface is entirely new and unmonitored by conventional tooling.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How to defend</h2>
      <ul className="text-text-secondary space-y-2 mt-4">
        <li><strong className="text-text-primary">Validate AI action configurations</strong> — Ensure <code className="text-signal">allowed_non_write_users</code> is explicitly restricted.</li>
        <li><strong className="text-text-primary">Scan instruction files</strong> — Check CLAUDE.md, .cursorrules, and similar files for injected directives.</li>
        <li><strong className="text-text-primary">Restrict secret access</strong> — AI agents should never have access to publish tokens or deployment credentials.</li>
        <li><strong className="text-text-primary">Monitor outbound requests</strong> — Flag any unexpected network calls from AI action runners.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber detects this</h2>
      <p className="text-text-secondary">
        OpenSyber&apos;s GitHub Actions AI Prompt Guard skill detects prompt injection patterns in issue bodies, PR descriptions, and comment threads before they reach an AI agent. It validates AI action configurations and flags overly permissive access controls.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Install the AI Prompt Guard skill.</p>
        <p className="text-text-secondary mt-1">Detect prompt injection in GitHub issues and PRs before your AI code reviewer processes them.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
