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

export default function ChatInterface({ messages, onSend, loading }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-200'
            }`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.action && (
                <div className="mt-2 px-3 py-2 bg-zinc-900/50 rounded-lg border border-zinc-700 text-xs">
                  <span className="text-emerald-400 font-mono">{msg.action}</span>
                  {msg.params && Object.keys(msg.params).length > 0 && (
                    <span className="text-zinc-400 ml-2">
                      {JSON.stringify(msg.params)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-surface-border px-4 py-3 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command... e.g. 'deploy to staging'"
          className="flex-1 bg-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm
                     border border-zinc-700 focus:border-emerald-500 focus:outline-none
                     placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg
                     hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
