'use client';

import { useState } from 'react';
import { Search, Loader2, Clock, Sparkles } from 'lucide-react';

interface ParsedQuery {
  id: string;
  filter: Record<string, unknown>;
  description: string;
  source: string;
}

interface QueryResponse {
  data: ParsedQuery;
}

const EXAMPLE_QUERIES = [
  'Show me critical events from last 24 hours',
  'Which agents have the most violations?',
  'List unresolved compliance issues',
  'What are the top security risks?',
  'Show recent anomalous activity',
  'How many high-severity findings this week?',
];

export function QueryClient() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; time: string }>>([]);

  async function handleSubmit(q?: string) {
    const finalQuery = q ?? query;
    if (!finalQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/proxy/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Query failed' }));
        throw new Error((err as { message: string }).message);
      }
      const body = (await res.json()) as QueryResponse;
      setResult(body.data);
      setHistory((prev) => [{ query: finalQuery, time: new Date().toISOString() }, ...prev.slice(0, 9)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a security question... e.g., 'Show me critical events from last 24 hours'"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 pl-10 pr-4 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-info hover:bg-info disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Query
          </button>
        </form>

        <div className="mt-4">
          <p className="text-xs text-neutral-500 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((eq) => (
              <button key={eq} type="button"
                onClick={() => { setQuery(eq); handleSubmit(eq); }}
                className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:border-info/50 hover:text-info transition">
                {eq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {result && <QueryResultView result={result} />}

      {history.length > 0 && <QueryHistory history={history} onSelect={(q) => { setQuery(q); handleSubmit(q); }} />}
    </div>
  );
}

function QueryResultView({ result }: { result: ParsedQuery }) {
  const filterJson = JSON.stringify(result.filter, null, 2);
  const hasFilter = result.filter && Object.keys(result.filter).length > 0;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium">Parsed Query</h3>
        <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-xs text-neutral-400">
          source: {result.source}
        </span>
      </div>
      {result.description && (
        <p className="mb-4 text-sm text-neutral-300">{result.description}</p>
      )}
      {hasFilter ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Filter</p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-300">
            {filterJson}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          No filter conditions were extracted from the query. Try a more specific request.
        </p>
      )}
    </div>
  );
}

function QueryHistory({ history, onSelect }: {
  history: Array<{ query: string; time: string }>;
  onSelect: (q: string) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-neutral-400" /> Recent Queries
      </h3>
      <div className="space-y-2">
        {history.map((h, i) => (
          <button key={i} type="button" onClick={() => onSelect(h.query)}
            className="w-full text-left rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-300 hover:border-info/50 hover:text-info transition">
            {h.query}
          </button>
        ))}
      </div>
    </div>
  );
}
