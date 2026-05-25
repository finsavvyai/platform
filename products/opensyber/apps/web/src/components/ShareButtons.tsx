'use client';

import { useState } from 'react';
import { Link2, Check, Twitter } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  text: string;
  title?: string;
  onAction?: (action: 'copy' | 'x' | 'linkedin') => void;
}

export function ShareButtons({ url, text, title: _title, onAction }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${url}`
    : url;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      onAction?.('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded-lg border border-wire px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface transition"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
      <a
        href={twitterUrl}
        onClick={() => onAction?.('x')}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg border border-wire px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface transition"
      >
        <Twitter className="h-3.5 w-3.5" />
        X / Twitter
      </a>
      <a
        href={linkedInUrl}
        onClick={() => onAction?.('linkedin')}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg border border-wire px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface transition"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        LinkedIn
      </a>
    </div>
  );
}
