import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
}

const baseClasses = [
  'font-semibold rounded-[10px] cursor-pointer transition-colors duration-150 inline-flex items-center justify-center gap-2',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A96E]',
].join(' ');

const variants = {
  primary: 'bg-[#1A1814] text-[#C9A96E] dark:bg-[#C9A96E] dark:text-[#1A1814] hover:bg-[#2C2A25] dark:hover:bg-[#D4B882] hover:shadow-[0_8px_24px_rgba(26,24,20,0.2)] dark:hover:shadow-[0_8px_24px_rgba(201,169,110,0.3)]',
  secondary: 'border border-[var(--dash-border)] text-[var(--dash-text)] bg-[var(--dash-surface)] hover:bg-[var(--dash-surface-hover)] hover:border-[var(--text-tertiary)]',
  destructive: 'bg-[#C0392B] text-white hover:bg-[#A93226]',
  ghost: 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface-hover)] hover:text-[var(--dash-text)]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[38px]',
  lg: 'px-5 py-2.5 text-sm min-h-[44px]',
};

export function Button({
  children, variant = 'primary', size = 'md',
  disabled, onClick, className, type = 'button',
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(baseClasses, variants[variant], sizes[size], className)}
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.96, y: 0 }}
      transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.button>
  );
}
