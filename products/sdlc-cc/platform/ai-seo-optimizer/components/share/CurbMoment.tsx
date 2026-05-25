import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CurbMomentProps {
  score: number;
  episodeTitle: string;
  onComplete?: () => void;
}

const CurbMoment = ({ score, episodeTitle, onComplete }: CurbMomentProps) => {
  const [phase, setPhase] = useState<'stare' | 'title' | 'done'>('stare');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('title'), 1500);
    const t2 = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <AnimatePresence mode="wait">
      {phase === 'stare' && (
        <motion.div
          key="stare"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="rounded-2xl bg-slate-900 overflow-hidden aspect-video flex items-center justify-center relative"
        >
          <FreezeFrame score={score} />
        </motion.div>
      )}

      {phase === 'title' && (
        <motion.div
          key="title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="rounded-2xl bg-slate-900 overflow-hidden aspect-video flex items-center justify-center relative"
        >
          <EpisodeTitleCard title={episodeTitle} score={score} />
        </motion.div>
      )}

      {phase === 'done' && (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-slate-900 overflow-hidden aspect-video flex items-center justify-center relative"
        >
          <EpisodeTitleCard title={episodeTitle} score={score} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function FreezeFrame({ score }: { score: number }) {
  const expression = score >= 75 ? 'smugFace' : score >= 45 ? 'blankStare' : 'disgust';
  const faces = {
    smugFace: { eyes: 'M16 14h.01 M20 14h.01', brow: 'M15 11.5c.5-.3 1.5-.3 2 0 M19 11.5c.5-.3 1.5-.3 2 0', mouth: 'M15.5 18c.83.5 2.17.5 3 0 M19.5 18c.83.5 1.17.5 2 0' },
    blankStare: { eyes: 'M16 14h.01 M20 14h.01', brow: 'M15 12h2 M19 12h2', mouth: 'M15 18h6' },
    disgust: { eyes: 'M16 14h.01 M20 14h.01', brow: 'M15 11l2 1 M21 11l-2 1', mouth: 'M16 19c.5-.5 1-.7 2-.7s1.5.2 2 .7' },
  };
  const face = faces[expression];

  return (
    <div className="text-center">
      <svg width="80" height="80" viewBox="8 4 20 24" className="mx-auto mb-3" aria-hidden="true">
        <circle cx="18" cy="14" r="8" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
        <path d={face.eyes} stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        <path d={face.brow} stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
        <path d={face.mouth} stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0.7] }}
        transition={{ duration: 1.5, times: [0, 0.3, 0.7, 1] }}
        className="text-slate-500 text-xs italic"
      >
        *stares in {score}/100*
      </motion.p>
    </div>
  );
}

function EpisodeTitleCard({ title, score }: { title: string; score: number }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '60%' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-px bg-slate-600 mb-6"
      />
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-white text-center font-serif italic text-lg md:text-xl tracking-wide leading-relaxed"
      >
        &ldquo;{title}&rdquo;
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 0.8 }}
        className="text-slate-500 text-[11px] mt-3 uppercase tracking-[0.2em]"
      >
        Season 12 &middot; Episode {score}
      </motion.p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '60%' }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        className="h-px bg-slate-600 mt-6"
      />
    </div>
  );
}

export default CurbMoment;
