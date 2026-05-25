'use client';

import { useState, useCallback } from 'react';
import { X, Brain, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { AiBotMessages } from './AiBotMessages';
import { getSuggestions, WELCOME_MESSAGE } from './bot-suggestions';
import type { Message } from './bot-suggestions';

function makeId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function LoadingDots(): React.ReactElement {
  return (
    <div className="flex gap-1 items-center px-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-info animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

export function AiBotPanel({ isOpen, onClose }: {
  isOpen: boolean; onClose: () => void;
}): React.ReactElement {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = {
      id: makeId(), role: 'user', content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/proxy/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      const content = (data as { answer?: string }).answer
        ?? (data as { message?: string }).message
        ?? 'Sorry, I couldn\'t process that. Please try again.';
      setMessages((prev) => [...prev, {
        id: makeId(), role: 'bot', content, timestamp: new Date().toISOString(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: makeId(), role: 'bot',
        content: 'Sorry, I couldn\'t process that. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const suggestions = getSuggestions(pathname);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const }}
          className="fixed inset-0 z-50 flex flex-col bg-neutral-950
            md:inset-auto md:bottom-20 md:right-6 md:w-96 md:h-[500px]
            md:rounded-xl md:border md:border-neutral-800 md:shadow-xl"
        >
          <Header onClose={onClose} />

          <AiBotMessages messages={messages} />

          {loading && (
            <div className="px-4 pb-2">
              <div className="bg-info/10 border border-info/20 rounded-xl rounded-bl-sm p-3 w-fit">
                <LoadingDots />
              </div>
            </div>
          )}

          <SuggestionChips suggestions={suggestions} onSelect={sendMessage} disabled={loading} />

          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2 p-3 border-t border-neutral-800">
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..." disabled={loading}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2
                text-sm flex-1 text-white placeholder-neutral-500 outline-none
                focus:border-neutral-600 transition disabled:opacity-50"
            />
            <button type="submit" disabled={!input.trim() || loading}
              aria-label="Send message"
              className="h-9 w-9 rounded-lg bg-info hover:bg-info transition
                flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              <Send className="h-4 w-4 text-white" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-info" />
        <h2 className="text-sm font-semibold text-white">OpenSyber AI</h2>
      </div>
      <button onClick={onClose} aria-label="Close AI assistant"
        className="text-neutral-400 hover:text-white transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SuggestionChips({ suggestions, onSelect, disabled }: {
  suggestions: string[]; onSelect: (s: string) => void; disabled: boolean;
}): React.ReactElement {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
      {suggestions.map((s) => (
        <button key={s} onClick={() => onSelect(s)} disabled={disabled}
          className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs
            hover:bg-neutral-800 transition cursor-pointer whitespace-nowrap
            text-neutral-300 disabled:opacity-50 shrink-0">
          {s}
        </button>
      ))}
    </div>
  );
}
