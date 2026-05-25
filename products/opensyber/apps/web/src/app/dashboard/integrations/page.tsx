import Link from 'next/link';
import { Plug, ArrowRight, Zap } from 'lucide-react';
import { INTEGRATIONS, CATEGORY_META } from './integrations-data';
import type { IntegrationCategory } from './integrations-data';

export const metadata = { title: 'Integrations — OpenSyber' };

const tierBadge: Record<string, string> = {
  free: 'bg-green-500/10 text-green-400 border-green-500/20',
  pro: 'bg-signal/10 text-signal border-info/20',
  team: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export default function IntegrationsPage() {
  const categories = Object.keys(CATEGORY_META) as IntegrationCategory[];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6 text-signal" />
            Integrations
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Connect OpenSyber to your entire stack — {INTEGRATIONS.length} integrations available
          </p>
        </div>
        <Link
          href="/dashboard/getting-started"
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-white hover:bg-signal-hover transition"
        >
          <Zap className="h-4 w-4" />
          Getting Started Guide
        </Link>
      </div>

      {/* Stats bar */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Integrations', value: INTEGRATIONS.length },
          { label: 'Free Tier', value: INTEGRATIONS.filter((i) => i.tier === 'free').length },
          { label: 'Categories', value: categories.length },
          { label: 'Webhook-Ready', value: '24+' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded border border-border bg-panel/30 p-4 text-center">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-text-dim mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Category sections */}
      {categories.map((cat) => {
        const meta = CATEGORY_META[cat];
        const items = INTEGRATIONS.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const Icon = meta.icon;

        return (
          <section key={cat} className="mb-10">
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${meta.color}`}>
              <Icon className="h-5 w-5" />
              {meta.label}
              <span className="text-xs text-text-dim font-normal ml-1">({items.length})</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((integration) => (
                <Link
                  key={integration.slug}
                  href={`/dashboard/integrations/${integration.slug}`}
                  className="group rounded border border-border bg-panel/30 p-5 hover:border-wire hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: `${integration.color}15`, color: integration.color }}
                      >
                        {integration.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm group-hover:text-white transition">
                          {integration.name}
                        </h3>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tierBadge[integration.tier]}`}>
                          {integration.tier}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-text-dim group-hover:text-text-secondary transition" />
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                    {integration.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {integration.features.slice(0, 2).map((f) => (
                      <span key={f} className="rounded-full bg-surface/60 px-2 py-0.5 text-[10px] text-text-dim">
                        {f}
                      </span>
                    ))}
                    {integration.features.length > 2 && (
                      <span className="rounded-full bg-surface/60 px-2 py-0.5 text-[10px] text-text-dim">
                        +{integration.features.length - 2} more
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
