import Head from "next/head";
import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <>
      <Head>
        <title>Checkout Complete | SDLC.ai</title>
        <meta
          name="description"
          content="Your checkout has been completed. Continue onboarding with SDLC.ai."
        />
      </Head>
      <main className="min-h-screen bg-sdlc-dark flex items-center justify-center px-4">
        <section className="max-w-xl w-full rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Checkout Complete</h1>
          <p className="text-gray-300 mb-6">
            Your payment is confirmed. Continue setup to activate your workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/getting-started"
              className="inline-flex items-center rounded-xl border border-gray-600 px-5 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Getting Started
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-gray-600 px-5 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
