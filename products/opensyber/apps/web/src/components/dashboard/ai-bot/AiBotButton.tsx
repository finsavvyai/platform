'use client';

import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { AiBotPanel } from './AiBotPanel';

export function AiBotButton(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 30_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen((p) => !p)}
        aria-label="Toggle AI assistant"
        className="fixed bottom-6 right-20 z-40 h-12 w-12 rounded-full bg-info
          hover:bg-info transition shadow-lg flex items-center justify-center"
      >
        <Brain className="h-5 w-5 text-white" />
        {showPulse && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>

      <AiBotPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
