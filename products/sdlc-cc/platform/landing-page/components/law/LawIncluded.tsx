import {
  ShieldCheck,
  ScrollText,
  Users,
  KeyRound,
  Wallet,
  Network,
  Chrome,
  Code2,
  type LucideIcon,
} from 'lucide-react';

type Feature = {
  icon: LucideIcon;
  name: string;
  description: string;
  cite?: string;
};

const features: Feature[] = [
  {
    icon: ShieldCheck,
    name: 'Five DLP presets',
    description:
      'pii_default · secrets · legal · finance · healthcare. Pluggable per tenant. Each pattern cites the regulation or standard it protects.',
    cite: 'ABA 1.6 · 45 CFR 160.103 · ISO 13616',
  },
  {
    icon: Chrome,
    name: 'Browser extension',
    description:
      'Intercepts ChatGPT, Claude, Gemini, and Copilot web UIs before submit. Scrubs PII + secrets via POST /v1/redact. Manifest V3, all major browsers.',
  },
  {
    icon: Code2,
    name: 'IDE + Office addins',
    description:
      'VS Code "Scrub selection" + "Scrub clipboard" commands. JetBrains, Cursor, Word, Outlook on the roadmap. Same backend, thin clients.',
  },
  {
    icon: ScrollText,
    name: 'HMAC-chained audit log',
    description:
      'Every request, redaction, and response is signed and chained. Tampering breaks the chain and is detectable. Replay-with-redaction supported.',
    cite: 'GDPR Art. 15 surfaceable',
  },
  {
    icon: Users,
    name: 'RBAC + SCIM 2.0',
    description:
      'Provision users + groups from Okta, Azure AD, or Google. Per-tenant scopes evaluated against OPA Rego policy.',
    cite: 'SCIM 2.0 (RFC 7644)',
  },
  {
    icon: KeyRound,
    name: 'SAML 2.0 + MFA + WebAuthn',
    description:
      'Federate auth with your existing identity provider. Just-in-time provisioning. WebAuthn enforced for admin accounts.',
  },
  {
    icon: Wallet,
    name: 'Per-tenant spend caps',
    description:
      'Set monthly token and dollar limits per team or user. RFC-7807 402 on overage. Custom-Managed Encryption Keys (CMEK) supported on Enterprise.',
  },
  {
    icon: Network,
    name: 'Multi-provider routing',
    description:
      'Anthropic, OpenAI, AWS Bedrock, Google Vertex, Azure OpenAI, and self-hosted (vLLM / Ollama) behind one interface. Automatic failover.',
  },
];

const LawIncluded = () => {
  return (
    <section id="whats-included" className="border-b law-rule" style={{ background: 'var(--law-paper-deep)' }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
        <p className="law-cite mb-3">Section 02</p>
        <h2
          className="text-3xl md:text-4xl font-semibold max-w-2xl"
          style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
        >
          What ships in the open-source repository.
        </h2>
        <p className="mt-4 max-w-2xl law-muted leading-relaxed">
          Every feature below is in the AGPL-3.0 tree. The commercial tiers
          unlock production use in proprietary deployments — the code is
          identical.
        </p>

        <ul className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, name, description, cite }) => (
            <li key={name} className="law-card flex flex-col">
              <Icon
                size={24}
                aria-hidden="true"
                style={{ color: 'var(--law-accent)' }}
              />
              <h3
                className="mt-4 text-lg font-semibold"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                {name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed law-muted flex-1">
                {description}
              </p>
              {cite && (
                <p className="law-cite mt-4" aria-label={`Reference: ${cite}`}>
                  {cite}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default LawIncluded;
