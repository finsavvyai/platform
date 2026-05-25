import { Check } from 'lucide-react';
import { tiers, addOns, type Tier } from './LawPricing.data';

const TierCard = ({ t }: { t: Tier }) => (
  <article
    className="law-card flex flex-col"
    style={t.cta.primary ? { borderColor: 'var(--law-ink)', borderWidth: 2 } : undefined}
    aria-labelledby={`tier-${t.id}`}
  >
    <p className="law-cite">{t.name}</p>
    <div className="mt-3 flex items-baseline gap-2">
      <span
        id={`tier-${t.id}`}
        className="text-3xl font-semibold"
        style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
      >
        {t.price}
      </span>
      <span className="text-sm law-muted">{t.cadence}</span>
    </div>
    <p className="mt-2 text-sm leading-relaxed law-muted">{t.blurb}</p>
    <ul className="mt-4 space-y-2 flex-1">
      {t.features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm">
          <Check
            size={14}
            className="mt-1 flex-shrink-0"
            style={{ color: 'var(--law-accent)' }}
            aria-hidden="true"
          />
          <span>{f}</span>
        </li>
      ))}
    </ul>
    <div className="mt-5">
      {t.cta.href ? (
        <a
          href={t.cta.href}
          className={t.cta.primary ? 'law-btn-primary' : 'law-btn-secondary'}
          rel={t.cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          data-plausible-event-name={`pricing_${t.id}_click`}
        >
          {t.cta.label}
        </a>
      ) : (
        <button
          type="button"
          className={t.cta.primary ? 'law-btn-primary' : 'law-btn-secondary'}
          data-checkout-id={t.cta.checkoutId}
          data-plausible-event-name={`pricing_${t.id}_click`}
        >
          {t.cta.label}
        </button>
      )}
    </div>
  </article>
);

const LawPricing = () => {
  return (
    <section id="pricing" className="border-b law-rule" style={{ background: 'var(--law-paper-deep)' }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
        <p className="law-cite mb-3">Section 04</p>
        <h2
          className="text-3xl md:text-4xl font-semibold max-w-2xl"
          style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
        >
          Four tiers. Same code. Pay only to lift the AGPL.
        </h2>
        <p className="mt-4 max-w-2xl law-muted leading-relaxed">
          Every paid tier ships the same binary as the AGPL release. You pay
          for the commercial buyout (close-sourced derivatives), tier-scoped
          support, and bundled add-ons — not for a different product.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((t) => (
            <TierCard key={t.id} t={t} />
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {addOns.map((a) => (
            <article key={a.name} className="law-card" aria-label={a.name}>
              <p className="law-cite">Add-on</p>
              <h3
                className="mt-2 text-xl font-semibold"
                style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
              >
                {a.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className="text-2xl font-semibold"
                  style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
                >
                  {a.price}
                </span>
                <span className="text-sm law-muted">{a.cadence}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed law-muted">
                {a.description}
              </p>
              <button
                type="button"
                className="mt-5 law-btn-secondary"
                data-checkout-id={a.checkoutId}
                data-plausible-event-name={`pricing_${a.name.toLowerCase().replace(/\s+/g, '_')}_click`}
              >
                Request {a.name.toLowerCase()}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LawPricing;
