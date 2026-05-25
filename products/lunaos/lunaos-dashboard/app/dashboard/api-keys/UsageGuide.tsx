'use client';

const USAGE_SNIPPET = `# Set your API key
export LUNAOS_API_KEY="lnos_live_..."

# Use with the CLI
luna run code-review --context "your code"

# Or use with curl
curl -X POST https://api.lunaos.ai/agents/execute \\
  -H "Authorization: Bearer $LUNAOS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agent": "code-review", "context": "your code"}'`;

export default function UsageGuide() {
    return (
        <div className="neon-card p-6">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Start</h3>
            <div className="bg-neutral-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-neutral-300 font-mono whitespace-pre">
                    {USAGE_SNIPPET}
                </pre>
            </div>
        </div>
    );
}
