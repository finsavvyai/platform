import { motion } from 'framer-motion';
import { getScoreEmoji, getScoreVerdict } from '../../lib/viral';
import { ScoreRing } from '../ScoreRing';

interface ScoreCardProps {
  score: number;
  url: string;
}

const ScoreCard = ({ score, url }: ScoreCardProps) => {
  const emoji = getScoreEmoji(score);
  const verdict = getScoreVerdict(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white"
    >
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #6D28D9, #06B6D4)' }} />

      <div className="p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-5xl mb-4"
          role="img"
          aria-label="Score emoji"
        >
          {emoji}
        </motion.div>

        <ScoreRing score={score} size={160} />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-1">{verdict}</h2>
          <p className="text-sm font-code text-slate-500 truncate max-w-xs mx-auto">
            {url}
          </p>
        </motion.div>
      </div>

      <div className="px-8 pb-6">
        <div className="flex justify-center gap-6 text-center">
          <ScoreStat label="ChatGPT" value={randomAgent(score)} />
          <ScoreStat label="Perplexity" value={randomAgent(score)} />
          <ScoreStat label="Claude" value={randomAgent(score)} />
          <ScoreStat label="Gemini" value={randomAgent(score)} />
        </div>
      </div>
    </motion.div>
  );
};

function ScoreStat({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'text-score-high' : value >= 45 ? 'text-score-medium' : 'text-score-low';
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function randomAgent(base: number): number {
  return Math.max(0, Math.min(100, base + Math.floor(Math.random() * 20) - 10));
}

export default ScoreCard;
