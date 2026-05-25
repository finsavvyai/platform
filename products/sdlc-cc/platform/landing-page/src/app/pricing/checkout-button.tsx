"use client";

import { useCallback } from "react";

type Props = {
  label: string;
  // Placeholder string until LemonSqueezy products are created.
  // After approval, the human swaps these for real variant IDs and
  // the click handler forwards to LemonSqueezy.com/checkout/buy/<id>.
  checkoutId: string;
  primary?: boolean;
};

const SEAL = "#7A1F2B";
const INK = "#0E1F33";
const RULE = "#D9D3C4";

export function CheckoutButton({ label, checkoutId, primary }: Props) {
  const onClick = useCallback(() => {
    // The actual LemonSqueezy.js overlay is loaded site-wide; once
    // real checkout IDs replace the placeholders, the LS SDK will
    // pick up `data-checkout-id` automatically. For the draft we
    // log the placeholder so a reviewer can confirm wiring.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[pricing] checkout requested", checkoutId);
    }
  }, [checkoutId]);

  const style = primary
    ? { backgroundColor: SEAL, color: "#FFFFFF", borderColor: SEAL }
    : { backgroundColor: "transparent", color: INK, borderColor: RULE };

  return (
    <button
      type="button"
      onClick={onClick}
      data-checkout-id={checkoutId}
      aria-label={label}
      style={style}
      className="w-full rounded-md border px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {label}
    </button>
  );
}
