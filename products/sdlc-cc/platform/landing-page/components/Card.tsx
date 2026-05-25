import { memo } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = memo(({ children, className = '' }) => {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`glass-panel rounded-3xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
});

Card.displayName = 'Card';
