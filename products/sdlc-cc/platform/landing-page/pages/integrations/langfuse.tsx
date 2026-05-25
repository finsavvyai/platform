import Head from "next/head";
import Link from "next/link";
import Header from "../../components/Header";
import { GitBranch, Server, Shield } from "lucide-react";

export default function LangfuseIntegration() {
  return (
    <>
      <Head>
        <title>Langfuse integration | SDLC.cc</title>
        <meta
          name="description"
          content="Point LANGFUSE_HOST at SDLC and gain DLP + OPA + audit on your LLM telemetry without code changes."
        />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Langfuse integration
          </h1>
          <p className="text-slate-600 mb-10">
            We expose the core Langfuse public API — traces, scores, prompts —
            at <code>/api/public/*</code>. Repoint <code>LANGFUSE_HOST</code>
            at <code>https://api.sdlc.cc</code> and your existing Langfuse
            SDK keeps working, gaining inline DLP redaction, OPA policy
            checks, and audit logging on every telemetry call.
          </p>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <GitBranch className="h-6 w-6 text-[#0a84ff]" />
              <h2 className="text-xl font-semibold text-slate-900">
                Drop-in replacement
              </h2>
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-sm">
{`from langfuse import Langfuse

client = Langfuse(
    host="https://api.sdlc.cc",
    public_key="pk_xxx",
    secret_key="sk_xxx",
)
client.trace(id="t-1", name="chat", input={"q": "..."})
client.score(trace_id="t-1", name="quality", value=0.9)`}
            </pre>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="h-6 w-6 text-[#0a84ff]" />
              <h2 className="text-xl font-semibold text-slate-900">
                Defense-in-depth pattern
              </h2>
            </div>
            <p className="text-slate-700 mb-4">
              Keep Langfuse as your observability surface. Put SDLC in front
              of the LLM call. SDLC enforces DLP / policy / audit; Langfuse
              sees the traces. Two systems, no overlap.
            </p>
            <pre className="bg-slate-100 rounded-lg p-4 overflow-x-auto text-sm text-slate-800">
{`App ─▶ SDLC gateway ─▶ OpenAI / Anthropic / ...
         │
         └──▶ Langfuse cloud (traces)
         └──▶ Audit log`}
            </pre>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Server className="h-6 w-6 text-[#0a84ff]" />
              <h2 className="text-xl font-semibold text-slate-900">
                Supported endpoints
              </h2>
            </div>
            <table className="w-full text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2">Path</th>
                  <th className="text-left py-2">Method</th>
                  <th className="text-left py-2">Behavior</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-slate-100">
                <tr>
                  <td className="py-2"><code>/api/public/traces</code></td>
                  <td>POST</td>
                  <td>Validates + forwards to events bus</td>
                </tr>
                <tr>
                  <td className="py-2"><code>/api/public/scores</code></td>
                  <td>POST</td>
                  <td>Requires traceId + name</td>
                </tr>
                <tr>
                  <td className="py-2"><code>/api/public/prompts</code></td>
                  <td>GET</td>
                  <td>Latest version, or <code>?version=N</code> exact</td>
                </tr>
                <tr>
                  <td className="py-2"><code>/api/public/prompts</code></td>
                  <td>POST</td>
                  <td>Stores prompt, auto-versions if not supplied</td>
                </tr>
              </tbody>
            </table>
            <p className="text-slate-600 text-sm mt-4">
              Not yet implemented: datasets, observations, sessions, projects.
              See{" "}
              <Link
                href="https://github.com/finsavvyai/sdlc-platform/blob/main/docs/integrations/langfuse.md"
                className="text-[#0a84ff] hover:underline"
              >
                the full integration doc
              </Link>
              {" "}for the roadmap.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              Auth
            </h2>
            <p className="text-slate-700">
              Both Langfuse Basic auth (<code>pk_xxx:sk_xxx</code>) and SDLC
              Bearer tokens work. Polyglot apps can share one credential.
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
