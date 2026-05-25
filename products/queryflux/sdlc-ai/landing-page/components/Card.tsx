import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 20px 44px rgba(8, 17, 38, 0.48)' }}
      className={`panel-glass rounded-xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
};
