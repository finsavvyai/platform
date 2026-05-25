import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "./checkout-button";
import { PricingFaq } from "./faq";
import { tiers, addons, FREE_NOTE } from "./tiers";

export const metadata: Metadata = {
  title: "Pricing — sdlc.cc",
  description:
    "AGPL-3.0 open source, free forever. Commercial license $4,000/seat/year removes copyleft obligations. Setup and support sold separately.",
  alternates: { canonical: "https://sdlc.cc/pricing" },
};

// Restrained legal-brief palette — see docs/brand/2026-05-16-brand-kit.md.
const palette = {
  ink: "#0E1F33",
  paper: "#F7F5EF",
  vellum: "#FFFFFF",
  seal: "#7A1F2B",
  rule: "#D9D3C4",
  muted: "#5C6776",
};

export default function PricingPage() {
  return (
    <main
      style={{ backgroundColor: palette.paper, color: palette.ink }}
      className="min-h-screen font-sans"
    >
      <a
        href="#pricing-cards"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to pricing
      </a>

      <header className="mx-auto max-w-6xl px-6 pt-16 pb-10">
        <p
          className="text-xs uppercase tracking-[0.18em]"
          style={{ color: palette.seal }}
        >
          Pricing
        </p>
        <h1
          className="mt-4 text-4xl md:text-5xl font-semibold leading-tight"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          The LLM gateway that stays on your network.
        </h1>
        <p
          className="mt-5 max-w-2xl text-lg leading-relaxed"
          style={{ color: palette.muted }}
        >
          {FREE_NOTE}{" "}
          <Link
            href="https://github.com/finsavvyai/sdlc-platform"
            className="underline decoration-1 underline-offset-4 hover:opacity-80"
          >
            git clone
          </Link>{" "}
          and run <code className="font-mono text-[0.95em]">docker-compose up</code>.
        </p>
      </header>

      <section
        id="pricing-cards"
        aria-label="Commercial offerings"
        className="mx-auto max-w-6xl px-6 pb-16"
      >
        <ul className="grid gap-6 md:grid-cols-3 list-none p-0">
          {tiers.map((tier) => (
            <li
              key={tier.id}
              className="rounded-lg border p-7 flex flex-col"
              style={{
                backgroundColor: palette.vellum,
                borderColor: tier.highlighted ? palette.seal : palette.rule,
                borderWidth: tier.highlighted ? 2 : 1,
              }}
            >
              {tier.highlighted && (
                <p
                  className="text-[11px] uppercase tracking-[0.18em] mb-3"
                  style={{ color: palette.seal }}
                >
                  Primary offering
                </p>
              )}
              <h2
                className="text-2xl font-semibold"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              >
                {tier.name}
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed min-h-[3.25rem]"
                style={{ color: palette.muted }}
              >
                {tier.tagline}
              </p>

              <div className="mt-5">
                <p className="text-3xl font-semibold tabular-nums">
                  {tier.priceLabel}
                </p>
                <p className="text-xs mt-1" style={{ color: palette.muted }}>
                  {tier.priceFootnote}
                </p>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true" style={{ color: palette.seal }}>
                      §
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 space-y-2">
                {tier.variants.map((v) => (
                  <CheckoutButton
                    key={v.checkoutId}
                    label={v.label}
                    checkoutId={v.checkoutId}
                    primary={tier.highlighted}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p
          className="mt-8 text-xs"
          style={{ color: palette.muted }}
        >
          Optional add-ons:{" "}
          {addons.map((a, i) => (
            <span key={a.name}>
              <strong style={{ color: palette.ink }}>{a.name}</strong> ({a.price})
              {i < addons.length - 1 ? " · " : ""}
            </span>
          ))}
          . See{" "}
          <Link
            href="/COMMERCIAL.md"
            className="underline decoration-1 underline-offset-4"
          >
            COMMERCIAL.md
          </Link>{" "}
          for the full terms.
        </p>
      </section>

      <section
        aria-label="Frequently asked questions"
        className="mx-auto max-w-3xl px-6 pb-20"
      >
        <h2
          className="text-2xl font-semibold mb-6"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Frequently asked
        </h2>
        <PricingFaq />
      </section>

      <footer
        className="border-t"
        style={{ borderColor: palette.rule }}
        role="contentinfo"
      >
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs flex flex-wrap gap-x-6 gap-y-2 justify-between"
             style={{ color: palette.muted }}>
          <p>© 2026 sdlc.cc — AGPL-3.0 open source; commercial license available.</p>
          <p>
            <Link href="/" className="underline decoration-1 underline-offset-4">
              Home
            </Link>{" "}
            ·{" "}
            <Link
              href="mailto:commercial@sdlc.cc"
              className="underline decoration-1 underline-offset-4"
            >
              commercial@sdlc.cc
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
