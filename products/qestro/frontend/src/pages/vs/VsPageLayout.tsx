import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useVsSeo, buildVsJsonLd } from './useVsSeo';
import { VerdictCard, PricingColumn } from './VsSections';
import { VsFeatureTable } from './VsFeatureTable';
import type { VsPageData } from './vs-types';

interface Props { data: VsPageData }

/**
 * Shared layout for every `/vs/:competitor` comparison landing page.
 * Optimized for SEO (semantic HTML, JSON-LD, OG tags) and honest merchandising:
 * we show where we win, where the competitor wins, and where they tie.
 */
export default function VsPageLayout({ data }: Props) {
  useVsSeo({
    title: data.seo.title,
    description: data.seo.description,
    canonical: data.seo.canonical,
    competitorName: data.competitor,
    jsonLd: buildVsJsonLd(data.competitor, data.seo.description),
  });

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <header
        className="sticky top-0 z-10 backdrop-blur-xl"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-primary) 85%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--brand-primary, #00F0FF) 20%, transparent)',
        }}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
            <span className="text-lg font-bold">Qestro</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/login"
              className="hidden sm:inline transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-lg px-4 py-2 font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)', color: '#030712' }}
            >
              Start free
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--brand-primary)' }}
          >
            Head-to-head comparison
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            Qestro vs {data.competitor}: Which is right for your team?
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.tagline}
          </p>
        </motion.section>

        <section aria-labelledby="verdict-heading" className="mb-20">
          <h2 id="verdict-heading" className="mb-6 text-2xl font-bold">At a glance</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <VerdictCard tone="qestro" title="Choose Qestro if..." body={data.hero.chooseQestro} />
            <VerdictCard tone="competitor" title={`Choose ${data.competitor} if...`} body={data.hero.chooseCompetitor} />
            <VerdictCard tone="neutral" title="They both excel at..." body={data.hero.bothGreat} />
          </div>
        </section>

        <section aria-labelledby="features-heading" className="mb-20">
          <h2 id="features-heading" className="mb-6 text-2xl font-bold">Feature comparison</h2>
          <VsFeatureTable competitor={data.competitor} rows={data.features} />
        </section>

        <section aria-labelledby="pricing-heading" className="mb-20">
          <h2 id="pricing-heading" className="mb-6 text-2xl font-bold">Pricing comparison</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <PricingColumn title="Qestro" tiers={data.pricing.qestro} highlight />
            <PricingColumn title={data.competitor} tiers={data.pricing.competitor} />
          </div>
        </section>

        <section aria-labelledby="wins-heading" className="mb-20">
          <h2 id="wins-heading" className="mb-6 text-2xl font-bold">When Qestro wins</h2>
          <div className="space-y-4" style={{ color: 'var(--text-secondary)' }}>
            {data.wins.qestroParagraphs.map((p, i) => (
              <p key={i} className="leading-relaxed">{p}</p>
            ))}
          </div>
          <h3 className="mt-10 mb-3 text-xl font-bold">When {data.competitor} wins</h3>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.wins.competitorParagraph}
          </p>
        </section>

        <section
          aria-labelledby="cta-heading"
          className="rounded-2xl p-8 sm:p-12 text-center"
          style={{
            border: '1px solid color-mix(in srgb, var(--brand-primary, #00F0FF) 30%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--brand-primary, #00F0FF) 5%, transparent)',
          }}
        >
          <h2 id="cta-heading" className="text-3xl font-bold">
            Ready to ship faster with tests that heal themselves?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Free tier includes 5 projects and 100 test runs per month. No credit card, no sales call, no demo required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)', color: '#030712' }}
            >
              Try Qestro free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/compare"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 font-medium transition-colors"
              style={{ borderColor: 'var(--text-muted)', color: 'var(--text-primary)' }}
            >
              See the full comparison
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
