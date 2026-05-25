import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import { Shield, Lock, FileCheck, Server } from "lucide-react";

export default function SecurityPage() {
  return (
    <>
      <Head>
        <title>Security & Compliance | SDLC.ai</title>
        <meta
          name="description"
          content="How SDLC.ai secures your data and supports compliance (SOC 2, GDPR, HIPAA)."
        />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Security & Compliance
          </h1>
          <p className="text-slate-600 mb-10">
            Our approach to securing your data and meeting compliance requirements.
          </p>

          <section className="space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Zero-trust architecture
                </h2>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                Every API call is authenticated and authorized. We do not assume
                trust by network or location. API keys are required for all
                programmatic access; support for SSO and SAML is on the roadmap.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Data protection
                </h2>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-3">
                PII and sensitive data are detected and can be redacted or
                tokenized before requests reach third-party LLM providers.
                Traffic is encrypted in transit (TLS). We follow least-privilege
                access and do not store your API keys in plaintext on our
                servers beyond what is required for request routing.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileCheck className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Audit & compliance
                </h2>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-3">
                Key actions (e.g. key creation, plan changes, admin actions) are
                logged for audit. We are working toward SOC 2 Type II and
                support GDPR and HIPAA-oriented controls where applicable.
                DPA and security questionnaires are available for enterprise
                customers.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Infrastructure & availability
                </h2>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                We run on trusted cloud providers with health checks, monitoring,
                and incident runbooks. For details on deployment and operations,
                see our deployment guide and runbooks in the repository.
              </p>
            </div>
          </section>

          <div className="mt-10 text-center">
            <Link
              href="/"
              className="text-[#0a84ff] font-medium hover:underline"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
