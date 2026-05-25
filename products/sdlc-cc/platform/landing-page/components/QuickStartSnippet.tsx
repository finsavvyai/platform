import Link from "next/link";
import { motion } from "framer-motion";
import type { ApiKeySummary } from "../lib/api-keys";

const GATEWAY_BASE =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "https://api.sdlc.cc";

type ApiKeyRecord = ApiKeySummary & {
  key?: string;
};

export default function QuickStartSnippet({
  apiKeys,
}: {
  apiKeys: ApiKeyRecord[];
}) {
  const activeKey = apiKeys.find((apiKey) => apiKey.key)?.key;
  const displayKey = activeKey || "YOUR_API_KEY";
  const hasMaskedKeysOnly = apiKeys.length > 0 && !activeKey;
  const baseUrl = `${GATEWAY_BASE.replace(/\/$/, "")}/v1`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-6"
    >
      <h3 className="text-lg font-bold text-white mb-3">Quick Start</h3>
      <p className="text-gray-300 mb-4">
        Use your API key with the OpenAI-compatible endpoint:
      </p>
      {hasMaskedKeysOnly ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Existing keys are masked after creation. Generate a new key if you
          need to copy a secret again.
        </p>
      ) : null}
      <div className="space-y-4 font-mono text-sm">
        <div className="bg-black rounded-lg p-4">
          <div className="text-gray-500 mb-2"># cURL</div>
          <pre className="text-gray-300 whitespace-pre-wrap break-all">
            {`curl -X POST "${baseUrl}/chat/completions" \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`}
          </pre>
        </div>
        <div className="bg-black rounded-lg p-4">
          <div className="text-gray-500 mb-2"># Python</div>
          <pre className="text-gray-300 whitespace-pre-wrap break-all">
            {`openai.api_base = "${baseUrl}"
openai.api_key = "${displayKey}"`}
          </pre>
        </div>
        <div className="bg-black rounded-lg p-4">
          <div className="text-gray-500 mb-2"># Node / OpenAI SDK</div>
          <pre className="text-gray-300 whitespace-pre-wrap break-all">
            {`baseURL: "${baseUrl}"
apiKey: "${displayKey}"`}
          </pre>
        </div>
      </div>
      <Link
        href="/getting-started"
        className="inline-block mt-4 text-blue-400 hover:text-blue-300 transition-colors"
      >
        View full documentation →
      </Link>
    </motion.div>
  );
}
