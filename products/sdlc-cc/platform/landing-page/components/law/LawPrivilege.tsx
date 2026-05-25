import { Inbox, Filter, FileSignature, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: Inbox,
    label: '01',
    title: 'Inbound DLP',
    body:
      'Requests from your matter-management system, document tools, or attorney workstations hit the gateway first. The legal preset scans for privileged content, client identifiers, and work-product markers before the request reaches any model provider.',
  },
  {
    icon: Filter,
    label: '02',
    title: 'Policy gate',
    body:
      'A matching policy decides what is allowed through, what is redacted, and what is blocked. Policies are versioned files in your repository — your general counsel can read them, change them, and review history in git.',
  },
  {
    icon: FileSignature,
    label: '03',
    title: 'Signed audit log',
    body:
      'The cleaned request, the chosen provider, the response, and the redaction decisions are HMAC-chained and written to your own Postgres or S3. Tampering with any row breaks the chain and is detectable on replay.',
  },
];

const LawPrivilege = () => {
  return (
    <section id="privilege" className="border-b law-rule">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
        <p className="law-cite mb-3">Section 03</p>
        <h2
          className="text-3xl md:text-4xl font-semibold max-w-2xl"
          style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
        >
          How the gateway protects privilege.
        </h2>
        <p className="mt-4 max-w-2xl law-muted leading-relaxed">
          Three deterministic steps. No model is involved in the decision to
          redact or block — the policy gate is rules-based so its output is
          reproducible in court.
        </p>

        <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 list-none">
          {steps.map(({ icon: Icon, label, title, body }, i) => (
            <li key={label} className="relative law-card">
              <div className="flex items-center gap-3">
                <span
                  className="law-cite"
                  style={{ color: 'var(--law-accent)' }}
                  aria-hidden="true"
                >
                  {label}
                </span>
                <Icon
                  size={20}
                  style={{ color: 'var(--law-accent)' }}
                  aria-hidden="true"
                />
              </div>
              <h3
                className="mt-3 text-lg font-semibold"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed law-muted">{body}</p>

              {i < steps.length - 1 && (
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10"
                  style={{ color: 'var(--law-accent)' }}
                />
              )}
            </li>
          ))}
        </ol>

        <aside
          className="mt-10 border-l-4 pl-5 py-3 max-w-3xl text-sm law-muted leading-relaxed"
          style={{ borderColor: 'var(--law-accent)', background: 'var(--law-paper-deep)' }}
        >
          <strong className="font-semibold" style={{ color: 'var(--law-ink)' }}>
            On the preset.
          </strong>{' '}
          The legal DLP preset is selectable, not mandatory. Its pattern set
          cites <em>ABA Model Rule 1.6</em> (confidentiality of information),{' '}
          <em>Federal Rule of Civil Procedure 26(b)(3)</em> (work-product
          doctrine), and <em>ABA Formal Opinion 512</em> (generative AI tools).
          Patterns are YAML files in <code>policies/legal/</code> — fork them
          to match your state bar opinion if it conflicts.
        </aside>
      </div>
    </section>
  );
};

export default LawPrivilege;
