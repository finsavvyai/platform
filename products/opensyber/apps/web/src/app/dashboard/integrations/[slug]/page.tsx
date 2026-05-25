import Link from 'next/link';
import { ArrowLeft, Check, Shield } from 'lucide-react';
import { notFound } from 'next/navigation';
import { INTEGRATIONS, CATEGORY_META } from '../integrations-data';
import { ConnectForm } from './ConnectForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const integration = INTEGRATIONS.find((i) => i.slug === slug);
  return { title: integration ? `${integration.name} — OpenSyber` : 'Integration' };
}

export default async function IntegrationDetailPage({ params }: Props) {
  const { slug } = await params;
  const integration = INTEGRATIONS.find((i) => i.slug === slug);
  if (!integration) notFound();

  const meta = CATEGORY_META[integration.category];
  const CatIcon = meta.icon;

  const tierColors: Record<string, string> = {
    free: 'bg-green-500/10 text-green-400 border-green-500/20',
    pro: 'bg-signal/10 text-signal border-info/20',
    team: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div>
      <Link
        href="/dashboard/integrations"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Integrations
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start gap-5">
        <div
          className="h-16 w-16 rounded flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{ backgroundColor: `${integration.color}15`, color: integration.color }}
        >
          {integration.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{integration.name}</h1>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tierColors[integration.tier]}`}>
              {integration.tier}
            </span>
          </div>
          <p className="text-sm text-text-secondary mb-2">{integration.description}</p>
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <CatIcon className="h-3.5 w-3.5" />
            {meta.label}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Features + Setup */}
        <div className="lg:col-span-2 space-y-6">
          {/* Features */}
          <div className="rounded border border-border bg-panel/30 p-6">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-signal" />
              Capabilities
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {integration.features.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-text-primary">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Setup steps */}
          <div className="rounded border border-border bg-panel/30 p-6">
            <h2 className="text-sm font-semibold mb-4">Setup Steps</h2>
            <ol className="space-y-3">
              {integration.setupSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-text-primary">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-bold text-signal">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right: Connect form */}
        <div>
          <ConnectForm integration={integration} />
        </div>
      </div>
    </div>
  );
}
