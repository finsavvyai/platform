import { useState } from 'react';
import { API_BASE_URL } from '../../config';

export default function SkillAiSection({ skillId }: { skillId: string }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');

  const askAi = async (q?: string) => {
    setLoading(true);
    setExplanation(null);
    const token = localStorage.getItem('pushci_token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/skills/${skillId}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question: q || undefined }),
      });
      if (!res.ok) {
        await res.json().catch(() => null);
        setExplanation('Could not get explanation. Please try again.');
      } else {
        const data = await res.json() as { explanation: string };
        setExplanation(data.explanation);
      }
    } catch {
      setExplanation('**Error:** Network request failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
          <span className="text-cyan-400">~</span> Ask AI
        </h3>
        {!explanation && !loading && (
          <button onClick={() => askAi()} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
            How does this work?
          </button>
        )}
      </div>
      {!explanation && !loading && (
        <div className="flex gap-2">
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask anything about this skill..."
            onKeyDown={e => e.key === 'Enter' && question.trim() && askAi(question)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none" />
          <button onClick={() => askAi(question || undefined)} disabled={loading}
            className="rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-2 text-xs font-medium hover:bg-cyan-500/30 transition disabled:opacity-50">
            Ask
          </button>
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-xs text-zinc-400">Analyzing skill...</span>
        </div>
      )}
      {explanation && (
        <div className="mt-2">
          <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{explanation}</div>
          <button onClick={() => { setExplanation(null); setQuestion(''); }}
            className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition">Ask another question</button>
        </div>
      )}
    </div>
  );
}
