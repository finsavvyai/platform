'use client';

import { useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import type { Message } from './bot-suggestions';

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function renderContent(text: string): React.ReactNode[] {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (match) {
      return (
        <a key={i} href={match[2]} className="text-info hover:underline"
          target="_blank" rel="noopener noreferrer">{match[1]}</a>
      );
    }
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

export function AiBotMessages({ messages }: { messages: Message[] }): React.ReactElement {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
          <div className={msg.role === 'bot'
            ? 'flex gap-2 max-w-[85%]'
            : 'max-w-[85%]'}>
            {msg.role === 'bot' && (
              <div className="h-6 w-6 rounded-full bg-info/20 flex items-center justify-center shrink-0 mt-1">
                <Brain className="h-3.5 w-3.5 text-info" />
              </div>
            )}
            <div>
              <div className={msg.role === 'bot'
                ? 'bg-info/10 border border-info/20 rounded-xl rounded-bl-sm p-3 text-sm text-neutral-200'
                : 'bg-neutral-800 rounded-xl rounded-br-sm p-3 text-sm text-neutral-200 ml-auto'}>
                {renderContent(msg.content)}
              </div>
              <p className="text-[10px] text-neutral-600 mt-1 px-1">
                {relativeTime(msg.timestamp)}
              </p>
            </div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
