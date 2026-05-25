import { motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useState, useCallback } from 'react';
import { generateViralMessage, getRegenerateQuip } from '../../lib/viral';

interface MessageGeneratorProps {
  score: number;
  onMessageChange: (msg: string) => void;
}

const MessageGenerator = ({ score, onMessageChange }: MessageGeneratorProps) => {
  const [message, setMessage] = useState(() => {
    const msg = generateViralMessage(score);
    onMessageChange(msg);
    return msg;
  });
  const [quip, setQuip] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);

  const regenerate = useCallback(() => {
    setIsSpinning(true);
    setTimeout(() => {
      const newMsg = generateViralMessage(score);
      setMessage(newMsg);
      onMessageChange(newMsg);
      setQuip(getRegenerateQuip());
      setIsSpinning(false);
    }, 400);
  }, [score, onMessageChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            AI-generated share message
          </span>
        </div>
        <motion.button
          onClick={regenerate}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary-50 transition-colors"
        >
          <motion.div
            animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.4 }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </motion.div>
          Regenerate
        </motion.button>
      </div>

      <motion.div
        key={message}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-slate-200 bg-white p-4"
      >
        <p className="text-sm text-slate-800 leading-relaxed pr-2">
          {message}
        </p>
      </motion.div>

      {quip && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] text-slate-400 text-center italic"
        >
          {quip}
        </motion.p>
      )}
    </div>
  );
};

export default MessageGenerator;
