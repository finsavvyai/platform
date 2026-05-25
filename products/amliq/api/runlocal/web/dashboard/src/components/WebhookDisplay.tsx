import { useState } from 'react';

export default function WebhookDisplay() {
  const [copied, setCopied] = useState(false);
  const baseUrl = import.meta.env.VITE_API_URL || 'https://pushci-api.workers.dev';
  const url = `${baseUrl}/webhook/github`;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
      <p className="text-xs text-zinc-500 mb-2">
        Add this URL as a webhook in your GitHub/GitLab/Bitbucket repo settings:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm text-emerald-400 font-mono bg-zinc-900
                         rounded px-3 py-2 overflow-x-auto">
          {url}
        </code>
        <button onClick={copy}
          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="mt-3 text-xs text-zinc-500 space-y-1">
        <p>Endpoints:</p>
        <p className="font-mono text-zinc-400">POST /webhook/github</p>
        <p className="font-mono text-zinc-400">POST /webhook/gitlab</p>
        <p className="font-mono text-zinc-400">POST /webhook/bitbucket</p>
      </div>
    </div>
  );
}
