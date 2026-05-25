import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  action?: string;
  params?: Record<string, unknown>;
}

interface Props {
  messages: Message[];
  onSend: (text: string) => void;
  loading?: boolean;
}

export type { Message };

const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  run_pipeline: { icon: '>', label: 'Run Pipeline', color: 'emerald' },
  deploy: { icon: '^', label: 'Deploy', color: 'blue' },
  diagnose_failure: { icon: '!', label: 'Diagnosing Failure', color: 'amber' },
  show_status: { icon: '=', label: 'Pipeline Status', color: 'cyan' },
  update_config: { icon: '*', label: 'Update Config', color: 'purple' },
  manage_secret: { icon: '#', label: 'Secret Manager', color: 'red' },
  optimize_pipeline: { icon: '~', label: 'Optimizing', color: 'indigo' },
  fix_pipeline: { icon: '+', label: 'Fixing Pipeline', color: 'orange' },
  generate_pipeline: { icon: '@', label: 'Generating', color: 'emerald' },
  heal_pipeline: { icon: '&', label: 'Self-Healing', color: 'emerald' },
};

function ActionCard({ action, params }: { action: string; params?: Record<string, unknown> }) {
  const meta = ACTION_META[action] || { icon: '>', label: action, color: 'zinc' };
  const c: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    cyan: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400',
    purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    red: 'border-red-500/30 bg-red-500/5 text-red-400',
    indigo: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400',
    orange: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
    zinc: 'border-zinc-600 bg-zinc-800/50 text-zinc-400',
  };
  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 ${c[meta.color] || c.zinc} animate-scale-in`}>
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-xs font-mono font-bold">{meta.icon}</span>
        <div>
          <span className="text-xs font-semibold">{meta.label}</span>
          {params && Object.keys(params).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(params).map(([k, v]) => (
                <span key={k} className="inline-flex rounded-md bg-black/20 px-2 py-0.5 text-[10px] font-mono">{k}: {String(v)}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="glass rounded-2xl rounded-bl-md px-5 py-3.5 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export default function ChatInterface({ messages, onSend, loading }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent text-black font-medium rounded-br-md'
                : 'glass text-zinc-200 rounded-bl-md'
            }`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.action && <ActionCard action={msg.action} params={msg.params} />}
            </div>
          </div>
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-surface-border/50 px-4 sm:px-6 py-4">
        <div className="flex gap-3 items-center glass rounded-2xl px-4 py-2 focus-within:border-accent/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything... e.g. 'why did my build fail?'"
            className="flex-1 bg-transparent text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-500 py-1.5"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl bg-accent text-black flex items-center justify-center text-sm font-bold hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            &gt;
          </button>
        </div>
      </form>
    </div>
  );
}
