import { useState } from 'react';

interface ShareButtonProps {
  saved: number;
  runs: number;
}

const TWEET_BASE = 'https://twitter.com/intent/tweet?text=';
const LINKEDIN_BASE = 'https://www.linkedin.com/sharing/share-offsite/?url=';

export default function ShareButton({ saved, runs }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const url = 'https://pushci.dev/tools/cost-calculator';
  const tweetText = `We saved $${saved.toFixed(2)}/month on CI with @pushci_dev — zero YAML, zero cloud bills. pushci.dev`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PushCI Savings', text: tweetText, url });
        return;
      } catch { /* user cancelled */ }
    }
    setOpen(!open);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${tweetText}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  }

  function openTweet() {
    window.open(`${TWEET_BASE}${encodeURIComponent(tweetText)}`, '_blank');
    setOpen(false);
  }

  function openLinkedIn() {
    const text = `We saved $${saved.toFixed(2)}/month on CI costs by switching to PushCI. ${runs.toLocaleString()} runs, $0 cloud bills. ${url}`;
    window.open(`${LINKEDIN_BASE}${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`, '_blank');
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleShare}
        disabled={runs === 0}
        className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30
          px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share savings
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl z-50">
          <button onClick={copyLink} className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700">
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button onClick={openTweet} className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700">
            Share on X / Twitter
          </button>
          <button onClick={openLinkedIn} className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700">
            Share on LinkedIn
          </button>
        </div>
      )}
    </div>
  );
}
