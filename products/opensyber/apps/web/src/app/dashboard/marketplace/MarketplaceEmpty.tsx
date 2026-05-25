import { Package } from 'lucide-react';

export function MarketplaceEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-border bg-panel/30 py-16 px-6 text-center">
      <Package className="h-12 w-12 text-text-dim" aria-hidden="true" />
      <p className="mt-4 font-medium text-text-primary">Marketplace launching soon</p>
      <p className="mt-2 text-sm text-text-dim max-w-md">
        We are curating the first wave of verified security skills. Build your own with the
        OpenSyber Skill SDK and be among the first publishers.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a
          href="/docs/skills"
          className="flex items-center gap-1 rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] hover:bg-signal-hover transition-colors"
        >
          Read the SDK Docs
        </a>
        <a
          href="/dashboard/getting-started"
          className="flex items-center gap-1 rounded-lg bg-surface px-4 py-2 text-xs font-medium text-text-primary min-h-[44px] hover:bg-neutral-700 transition-colors"
        >
          Getting Started Guide
        </a>
      </div>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
        {['SAST Scanner', 'Secret Detector', 'SBOM Generator'].map((name) => (
          <div key={name} className="rounded-lg border border-dashed border-wire bg-panel/50 p-3 text-center">
            <p className="text-xs font-medium text-text-secondary">{name}</p>
            <p className="text-[10px] text-text-dim mt-1">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  );
}
