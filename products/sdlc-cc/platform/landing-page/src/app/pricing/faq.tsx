"use client";

import { useId, useState } from "react";

type Item = { q: string; a: React.ReactNode };

const items: Item[] = [
  {
    q: "Why $4,000?",
    a: (
      <>
        It is the price at which a managing partner can sign without a
        procurement review at most mid-market firms (50-500 attorneys),
        and at which the project sustains one full-time maintainer for
        each ~10 seats sold. Harvey and Casetext sell into the same
        category at $50,000–$300,000 per year; we price for the firms
        they do not call back.
      </>
    ),
  },
  {
    q: "Can we evaluate first?",
    a: (
      <>
        Yes. The full gateway is AGPL-3.0 — clone the repo, run{" "}
        <code className="font-mono">docker compose up</code>, and query
        it on your own infrastructure. Evaluation does not require a
        commercial license. You only need the commercial license when
        you ship the gateway inside a closed-source product and do not
        want the AGPL source-disclosure obligation.
      </>
    ),
  },
  {
    q: "How fast do we get the license PDF?",
    a: (
      <>
        Within 24 hours of checkout, weekdays. The PDF is a signed
        agreement bearing your organisation legal name, seat count,
        and term. The same key activates the gateway&rsquo;s{" "}
        <code className="font-mono">/admin/license</code> endpoint
        (once Track A1 ships — see <code>ROADMAP.md</code>).
      </>
    ),
  },
  {
    q: "Do you offer purchase orders or NET-30?",
    a: (
      <>
        Yes, for orders of 10 seats or more, or for the Setup
        Engagement. Email{" "}
        <a
          className="underline decoration-1 underline-offset-4"
          href="mailto:commercial@sdlc.cc"
        >
          commercial@sdlc.cc
        </a>{" "}
        with your billing address and any vendor-onboarding forms.
        Smaller orders run through LemonSqueezy at checkout.
      </>
    ),
  },
];

export function PricingFaq() {
  return (
    <ul className="space-y-3 list-none p-0">
      {items.map((item) => (
        <FaqItem key={item.q} item={item} />
      ))}
    </ul>
  );
}

function FaqItem({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headerId = useId();

  return (
    <li
      className="rounded-md border"
      style={{ borderColor: "#D9D3C4", backgroundColor: "#FFFFFF" }}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ color: "#0E1F33" }}
      >
        <span className="font-medium">{item.q}</span>
        <span
          aria-hidden="true"
          className="text-lg leading-none"
          style={{ color: "#7A1F2B" }}
        >
          {open ? "–" : "+"}
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="px-5 pb-5 text-sm leading-relaxed"
          style={{ color: "#5C6776" }}
        >
          {item.a}
        </div>
      )}
    </li>
  );
}
