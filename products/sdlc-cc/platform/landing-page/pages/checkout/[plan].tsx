import { useEffect } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  CheckoutPlan,
  getCheckoutFallbackTarget,
  toPlan,
} from "../../lib/checkout";

export const config = {
  runtime: "experimental-edge",
};

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const plan = toPlan(params?.plan);
  if (!plan) {
    return {
      props: {
        plan: "enterprise",
        target: "/#pricing",
      },
    };
  }

  return {
    props: {
      plan,
      target: getCheckoutFallbackTarget(plan),
    },
  };
};

export default function CheckoutRedirectPage({
  plan,
  target,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  useEffect(() => {
    let cancelled = false;

    const redirectToCheckout = async () => {
      if (plan === "enterprise") {
        window.location.replace(target);
        return;
      }

      try {
        const response = await fetch("/api/checkout/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            source: "sdlc.cc-checkout-route",
            currentPath: window.location.pathname,
          }),
        });

        if (!response.ok) throw new Error(`checkout-create-${response.status}`);
        const data = (await response.json()) as { url?: string };
        if (!data.url) throw new Error("checkout-url-missing");
        if (!cancelled) window.location.replace(data.url);
        return;
      } catch (error) {
        console.warn("Checkout creation failed, using fallback target", error);
      }

      if (!cancelled) window.location.replace(target);
    };

    void redirectToCheckout();
    return () => {
      cancelled = true;
    };
  }, [plan, target]);

  return (
    <main className="min-h-screen bg-sdlc-dark flex items-center justify-center px-4">
      <section className="max-w-lg w-full rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">
          Redirecting to checkout...
        </h1>
        <p className="text-gray-300 mb-6">
          If you are not redirected automatically, continue using the link
          below.
        </p>
        <a
          href={target}
          className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Continue
        </a>
      </section>
    </main>
  );
}
