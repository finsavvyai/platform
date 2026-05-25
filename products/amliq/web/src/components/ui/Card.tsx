import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className, style: styleProp, onClick, hover }: CardProps) {
  const baseClasses = clsx(
    'rounded-2xl p-5 border',
    className,
  );

  const style = {
    background: 'var(--dash-surface)',
    borderColor: 'var(--dash-border)',
    ...styleProp,
  };

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={clsx(baseClasses, 'text-start w-full cursor-pointer')}
        style={style}
        whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.button>
    );
  }

  if (hover) {
    return (
      <motion.div
        className={baseClasses}
        style={style}
        whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={clsx(baseClasses, 'transition-all duration-200')} style={style}>{children}</div>;
}
