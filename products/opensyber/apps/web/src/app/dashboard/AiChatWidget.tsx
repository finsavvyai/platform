'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Globe } from 'lucide-react';
import { streamChat, type ChatMessage as Message } from './stream-chat';

const LANGUAGES = [
  { code: 'en', label: 'English', greeting: 'Hi! I\'m the OpenSyber assistant. How can I help?' },
  { code: 'he', label: 'עברית', greeting: 'שלום! אני העוזר של OpenSyber. איך אני יכול לעזור?' },
  { code: 'es', label: 'Español', greeting: '¡Hola! Soy el asistente de OpenSyber. ¿En qué puedo ayudarte?' },
  { code: 'fr', label: 'Français', greeting: 'Bonjour! Je suis l\'assistant OpenSyber. Comment puis-je vous aider?' },
  { code: 'de', label: 'Deutsch', greeting: 'Hallo! Ich bin der OpenSyber-Assistent. Wie kann ich helfen?' },
  { code: 'ja', label: '日本語', greeting: 'こんにちは！OpenSyberアシスタントです。何かお手伝いできますか？' },
  { code: 'zh', label: '中文', greeting: '你好！我是OpenSyber助手。有什么可以帮您的？' },
  { code: 'pt', label: 'Português', greeting: 'Olá! Sou o assistente OpenSyber. Como posso ajudar?' },
  { code: 'ar', label: 'العربية', greeting: 'مرحباً! أنا مساعد OpenSyber. كيف يمكنني مساعدتك؟' },
];

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: LANGUAGES[0].greeting },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const switchLang = (code: string) => {
    setLang(code);
    setShowLangPicker(false);
    const greeting = LANGUAGES.find((l) => l.code === code)?.greeting ?? LANGUAGES[0].greeting;
    setMessages([{ role: 'assistant', content: greeting }]);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setLoading(true);

    const apiMessages = newMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
    try {
      const streamed = await streamChat(apiMessages, (delta) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
          }
          return [...prev, { role: 'assistant', content: delta, streaming: true }];
        });
      });
      if (!streamed) {
        // Fall back to the non-streaming endpoint.
        const res = await fetch('/api/proxy/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
        });
        const data = await res.json();
        const reply = data?.data?.reply ?? data?.reply ?? 'Sorry, please try again.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-signal text-white shadow-lg transition-transform duration-200 hover:scale-105"
        aria-label="Open AI assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded border border-border bg-panel shadow-2xl sm:bottom-6 sm:right-6 sm:w-96">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-signal" />
          <span className="text-sm font-semibold">OpenSyber AI</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:bg-surface min-h-[44px]"
              aria-label="Change language"
            >
              <Globe className="h-3.5 w-3.5" />
              {LANGUAGES.find((l) => l.code === lang)?.label}
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-wire bg-surface py-1 shadow-lg z-10">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => switchLang(l.code)}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-neutral-700 min-h-[36px] ${lang === l.code ? 'text-signal' : 'text-text-primary'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-text-dim hover:bg-surface min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '360px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && <Bot className="h-5 w-5 text-signal flex-shrink-0 mt-0.5" aria-hidden="true" />}
            <div className={`rounded px-3 py-2 text-sm max-w-[80%] ${msg.role === 'user' ? 'bg-signal text-white' : 'bg-surface text-neutral-200'}`}>
              {msg.content}
            </div>
            {msg.role === 'user' && <User className="h-5 w-5 text-text-dim flex-shrink-0 mt-0.5" aria-hidden="true" />}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <Bot className="h-5 w-5 text-signal flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="rounded bg-surface px-3 py-2 text-sm text-text-secondary animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === 'he' || lang === 'ar' ? '...שאל על OpenSyber' : 'Ask about OpenSyber...'}
            dir={lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr'}
            className="flex-1 rounded-lg border border-wire bg-surface px-3 py-2 text-sm min-h-[44px] focus:border-signal focus:outline-none"
            aria-label="Chat message"
            disabled={loading}
          />
          <button type="submit" disabled={!input.trim() || loading} className="flex items-center justify-center rounded-lg bg-signal px-3 min-h-[44px] min-w-[44px] text-white hover:bg-signal-hover disabled:opacity-50" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
