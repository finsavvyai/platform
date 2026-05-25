import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { getCurbMonologue } from '../../lib/curb';

interface CurbMonologueProps {
  score: number;
}

const CurbMonologue = ({ score }: CurbMonologueProps) => {
  const [monologue, setMonologue] = useState(() => getCurbMonologue(score));
  const [isSpinning, setIsSpinning] = useState(false);

  const regenerate = useCallback(() => {
    setIsSpinning(true);
    setTimeout(() => {
      setMonologue(getCurbMonologue(score));
      setIsSpinning(false);
    }, 300);
  }, [score]);

  return (
    <div className="rounded-2xl bg-slate-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
          Larry&apos;s inner monologue
        </span>
        <motion.button
          onClick={regenerate}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <motion.div
            animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.3 }}
          >
            <RefreshCw className="h-3 w-3" />
          </motion.div>
          New rant
        </motion.button>
      </div>

      <motion.blockquote
        key={monologue}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-slate-700 pl-4"
      >
        {monologue}
      </motion.blockquote>
    </div>
  );
};

export default CurbMonologue;
