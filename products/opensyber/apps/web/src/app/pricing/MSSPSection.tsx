import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';

interface MSSPSectionProps {
  salesHref: string;
}

export function MSSPSection({ salesHref }: MSSPSectionProps) {
  return (
    <div className="mt-16 mx-auto max-w-3xl rounded border border-border bg-panel/30 p-8 md:p-10">
      <div className="flex items-start gap-4">
        <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-lg bg-signal/10 flex-shrink-0">
          <Building2 className="h-6 w-6 text-signal" />
        </div>
        <div className="flex-1">
          <h3 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-wide mb-2">
            MANAGED SERVICE PROVIDERS
          </h3>
          <p className="text-text-secondary mb-4 leading-relaxed">
            Resell OpenSyber to your clients. 40% wholesale discount. White-label option.
            15% referral revenue share. Minimum 5 client licenses.
          </p>
          <div className="flex flex-wrap gap-4 mb-6">
            <Stat value="40%" label="Wholesale discount" />
            <Stat value="15%" label="Referral revenue share" />
            <Stat value="5+" label="Client minimum" />
          </div>
          <Link
            href={salesHref}
            className="inline-flex items-center gap-2 rounded border border-signal text-signal px-6 py-3 text-sm font-medium hover:bg-signal/10 transition"
          >
            Contact MSP Sales <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded bg-surface border border-border px-4 py-2">
      <span className="text-lg font-bold text-signal">{value}</span>
      <span className="text-xs text-text-secondary ml-2">{label}</span>
    </div>
  );
}
