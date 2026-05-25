import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { getCurbShareText } from '../../lib/curb';

interface CurbShareButtonProps {
  score: number;
  episodeTitle: string;
  url: string;
}

const CurbShareButton = ({ score, episodeTitle, url }: CurbShareButtonProps) => {
  const [copied, setCopied] = useState(false);
  const shareText = getCurbShareText(score, episodeTitle);
  const fullText = `${shareText} ${url}`;

  const shareToX = () => {
    const text = encodeURIComponent(fullText);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener');
  };

  const shareToLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener'
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest text-center">
        Spread the misery
      </p>

      <motion.button
        onClick={shareToX}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-slate-900 text-white font-medium transition-all hover:bg-slate-800 border border-slate-700 group"
      >
        <XLogo />
        <span className="text-sm">Post the Curb moment on X</span>
      </motion.button>

      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={shareToLinkedIn}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium transition-colors"
          style={{ background: '#0A66C2' }}
        >
          <LinkedInLogo />
          LinkedIn
        </motion.button>

        <motion.button
          onClick={handleCopy}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-score-high" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy rant'}
        </motion.button>
      </div>

      <PreviewCard text={shareText} />
    </div>
  );
};

function PreviewCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
        Share preview
      </p>
      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

function XLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default CurbShareButton;
