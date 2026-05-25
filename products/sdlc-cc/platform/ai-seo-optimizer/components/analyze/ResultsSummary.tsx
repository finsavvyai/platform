import { motion } from 'framer-motion';
import { ExternalLink, Clock } from 'lucide-react';
import { ScoreRing } from '../ScoreRing';

interface ResultsSummaryProps {
  url: string;
  score: number;
  summary: string;
  timestamp: string;
}

const ResultsSummary = ({ url, score, summary, timestamp }: ResultsSummaryProps) => {
  const date = new Date(timestamp).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6 md:p-8"
    >
      <div className="flex flex-col md:flex-row items-center gap-6">
        <ScoreRing score={score} size={140} label="AI Visibility" />
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
            <ExternalLink className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-code text-slate-600 truncate max-w-md">
              {url}
            </span>
          </div>
          <p className="text-lg text-slate-800 leading-relaxed mb-3">
            {summary}
          </p>
          <div className="flex items-center gap-1.5 justify-center md:justify-start text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            <span>Analyzed {date}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ResultsSummary;
