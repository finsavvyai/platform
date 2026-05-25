import { Check, Minus } from 'lucide-react';

type Row = {
  label: string;
  saas: string | boolean;
  selfHost: string | boolean;
};

const rows: Row[] = [
  {
    label: 'Where prompts travel',
    saas: 'Through the vendor and onward to the LLM',
    selfHost: 'Through your gateway. PII scrubbed first.',
  },
  {
    label: 'Who has the encryption keys',
    saas: 'Vendor (and their cloud provider)',
    selfHost: 'You do. CMEK supported on Enterprise.',
  },
  {
    label: 'Vendor subpoena exposure',
    saas: 'Vendor can be compelled separately',
    selfHost: 'Compulsion runs through your firm',
  },
  {
    label: 'Audit log custody',
    saas: 'Vendor-hosted, vendor-mutable',
    selfHost: 'HMAC-chained, in your warehouse',
  },
  {
    label: 'DLP customisation',
    saas: 'Vendor presets only',
    selfHost: 'Five presets + custom Rego patterns',
  },
  {
    label: 'Model choice',
    saas: 'Vendor-selected providers',
    selfHost: 'Anthropic, OpenAI, Bedrock, Vertex, Azure, self-hosted',
  },
  {
    label: 'Source code access',
    saas: false,
    selfHost: true,
  },
  {
    label: 'Setup time',
    saas: 'Minutes',
    selfHost: 'Half a day (or paid setup engagement)',
  },
];

const Cell = ({ value }: { value: string | boolean }) => {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center gap-2">
        <Check size={16} style={{ color: 'var(--law-accent)' }} aria-hidden="true" />
        <span className="sr-only">Yes</span>
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 law-muted">
        <Minus size={16} aria-hidden="true" />
        <span className="sr-only">No</span>
        No
      </span>
    );
  }
  return <span>{value}</span>;
};

const LawWhySelfHost = () => {
  return (
    <section id="why-self-host" className="border-b law-rule">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
        <p className="law-cite mb-3">Section 01</p>
        <h2
          className="text-3xl md:text-4xl font-semibold max-w-2xl"
          style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
        >
          Why a privacy gateway instead of a hosted LLM proxy?
        </h2>
        <p className="mt-4 max-w-2xl law-muted leading-relaxed">
          Hosted prompt-scrub services exist. They are not the right answer
          for every team. Honest comparison so you can decide for yourself.
          Lakera sold to Cisco in 2025 (~$300M) — buyers know the category
          and want a non-acquired-by-bigco alternative.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Hosted vs self-host comparison">
            <thead>
              <tr className="border-b-2 law-rule">
                <th
                  scope="col"
                  className="py-3 pr-4 text-xs uppercase tracking-wider law-muted font-medium align-bottom"
                  style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
                >
                  Concern
                </th>
                <th
                  scope="col"
                  className="py-3 px-4 text-sm font-semibold align-bottom"
                  style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
                >
                  Hosted prompt-scrub SaaS
                  <div className="text-xs font-normal law-muted mt-0.5">
                    (Lakera-like, vendor-managed)
                  </div>
                </th>
                <th
                  scope="col"
                  className="py-3 pl-4 text-sm font-semibold align-bottom"
                  style={{ fontFamily: 'var(--font-heading, Inter), system-ui', color: 'var(--law-accent)' }}
                >
                  Self-hosted sdlc.cc
                  <div className="text-xs font-normal law-muted mt-0.5">
                    (your infrastructure)
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b law-rule align-top">
                  <th
                    scope="row"
                    className="py-4 pr-4 text-sm font-medium law-muted"
                    style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
                  >
                    {r.label}
                  </th>
                  <td className="py-4 px-4 text-sm">
                    <Cell value={r.saas} />
                  </td>
                  <td className="py-4 pl-4 text-sm">
                    <Cell value={r.selfHost} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default LawWhySelfHost;
