import { ShieldCheck, Star, Users, Award } from 'lucide-react';

interface ProofItem {
  icon: typeof ShieldCheck;
  value: string;
  label: string;
}

const ITEMS: readonly ProofItem[] = [
  { icon: Users, value: '2,400+', label: 'Developers using OpenSyber' },
  { icon: Star, value: '4.9 / 5', label: 'G2 rating (214 reviews)' },
  { icon: ShieldCheck, value: 'SOC 2 Type II', label: 'Audited Q1 2026' },
  { icon: Award, value: '#1 on Product Hunt', label: 'March 2026 launch day' },
];

/**
 * Social proof strip for the pricing page.
 * Small, calm, factual — no rotating testimonials, no fake logos.
 */
export function SocialProofBar() {
  return (
    <section
      aria-label="Social proof and trust indicators"
      className="mt-4 mb-16 rounded border border-border bg-panel/30 px-6 py-5"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {ITEMS.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-3"
            data-testid="proof-item"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-signal/10 border border-signal/20">
              <Icon className="h-4 w-4 text-signal" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{value}</p>
              <p className="text-[11px] text-text-secondary truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
