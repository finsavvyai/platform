import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function PageTransition({ children }: Props) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ height: '100%', display: 'contents' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
