import { useState, useCallback } from 'react';
import ChatInterface, { type Message } from '../components/ChatInterface';

const suggestions = [
  'deploy to staging', 'why did my build fail?', 'run only tests',
  'show pipeline status', 'run linter', 'list secrets',
];

let msgId = 0;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { id: `m-${++msgId}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await fetch('/api/nlp/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        id: `m-${++msgId}`, role: 'assistant',
        text: data.message ?? 'Done.', action: data.action, params: data.params,
      }]);
    } catch {
      setMessages((prev) => [...prev,
        { id: `m-${++msgId}`, role: 'assistant', text: 'Failed to reach API.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-56 border-r border-surface-border p-4 hidden lg:block">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Suggested Commands
        </h3>
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => sendMessage(s)}
              className="w-full text-left text-sm px-3 py-2 rounded-lg text-zinc-300
                         hover:bg-zinc-800 hover:text-emerald-400 transition-colors">
              {s}
            </button>
          ))}
        </div>
        {messages.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              History
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {messages.filter((m) => m.role === 'user').slice(-8).map((m) => (
                <div key={m.id} className="text-xs text-zinc-500 truncate px-2 py-1">{m.text}</div>
              ))}
            </div>
          </div>
        )}
      </aside>
      <div className="flex-1 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">{'>'}_</div>
              <h2 className="text-xl font-semibold text-zinc-200 mb-2">PushCI Assistant</h2>
              <p className="text-zinc-400 text-sm">Ask anything about your CI/CD pipeline.</p>
            </div>
          </div>
        )}
        <ChatInterface messages={messages} onSend={sendMessage} loading={loading} />
      </div>
    </div>
  );
}
