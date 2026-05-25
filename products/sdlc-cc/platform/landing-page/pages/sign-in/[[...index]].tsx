import { SignIn } from "@clerk/nextjs";
import Head from "next/head";
import Link from "next/link";
import { hasValidClerkKeys } from "../../lib/clerk-env";

export const config = {
  runtime: "experimental-edge",
};

export default function SignInPage() {
  if (!hasValidClerkKeys()) {
    return (
      <>
        <Head>
          <title>Sign In | SDLC.ai</title>
          <meta
            name="description"
            content="Authentication is being configured for this environment."
          />
        </Head>
        <main className="min-h-screen bg-sdlc-dark flex items-center justify-center px-4">
          <section className="max-w-lg w-full rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-3">
              Sign-in Coming Soon
            </h1>
            <p className="text-gray-300 mb-6">
              Authentication is not enabled on this deployment yet.
            </p>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Request Access
            </Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Sign In | SDLC.ai</title>
        <meta name="description" content="Sign in to your SDLC.ai account" />
      </Head>

      <div className="min-h-screen bg-sdlc-dark flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">
              Sign in to access your SDLC.ai dashboard
            </p>
          </div>

          <SignIn
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-gray-900 border border-gray-700",
              },
            }}
          />
        </div>
      </div>
    </>
  );
}

// Force server-side rendering to avoid build-time pre-rendering with invalid Clerk keys
export async function getServerSideProps() {
  return { props: {} };
}
