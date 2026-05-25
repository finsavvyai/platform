import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2 } from 'lucide-react';

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
}

const UrlInput = ({ onAnalyze, isLoading }: UrlInputProps) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a URL.');
      return;
    }

    let normalized = url.trim();
    if (!normalized.startsWith('http')) {
      normalized = `https://${normalized}`;
    }

    try {
      new URL(normalized);
    } catch {
      setError('Please enter a valid URL.');
      return;
    }

    onAnalyze(normalized);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter a URL to analyze, e.g. example.com/blog"
            aria-label="URL to analyze"
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all text-lg disabled:opacity-60"
          />
        </div>
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={isLoading ? {} : { y: -1 }}
          whileTap={isLoading ? {} : { scale: 0.98 }}
          className="button-primary px-8 py-4 text-lg gap-2 flex-shrink-0 disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Analyze'
          )}
        </motion.button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
};

export default UrlInput;
