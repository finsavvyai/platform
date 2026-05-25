'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  meta?: {
    latencyMs: number;
    cached: boolean;
    boosted: boolean;
    model: string;
    estimatedCostUsd: number;
    contextSavings: string;
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: input };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        history: updated.slice(-10),
      }),
    });

    const data = await res.json();
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: data.reply, meta: data.meta },
    ]);
    setLoading(false);
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>ClawPipe Chatbot</h1>
      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#0071e3' : '#f5f5f7',
              color: msg.role === 'user' ? '#fff' : '#1d1d1f',
            }}
          >
            <p style={{ margin: 0 }}>{msg.text}</p>
            {msg.meta && (
              <small style={styles.meta}>
                {msg.meta.cached ? 'cached' : msg.meta.model}
                {' | '}
                {msg.meta.latencyMs}ms
                {' | '}
                ${msg.meta.estimatedCostUsd.toFixed(4)}
                {msg.meta.contextSavings !== '0%' &&
                  ` | saved ${msg.meta.contextSavings}`}
              </small>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.bubble, alignSelf: 'flex-start', background: '#f5f5f7' }}>
            <p style={{ margin: 0, opacity: 0.5 }}>Thinking...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button style={styles.button} type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 640,
    margin: '0 auto',
    padding: 24,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  title: { fontSize: 24, fontWeight: 600, marginBottom: 16 },
  chatBox: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 16,
  },
  bubble: {
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: 16,
    fontSize: 15,
  },
  meta: { display: 'block', marginTop: 4, opacity: 0.7, fontSize: 11 },
  form: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #d2d2d7',
    fontSize: 15,
    outline: 'none',
  },
  button: {
    padding: '10px 20px',
    borderRadius: 12,
    border: 'none',
    background: '#0071e3',
    color: '#fff',
    fontSize: 15,
    cursor: 'pointer',
  },
};
