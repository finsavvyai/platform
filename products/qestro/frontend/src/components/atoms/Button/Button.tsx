import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'neon' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  glow?: boolean; // New prop for extra glow
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  glow = false,
  ...props
}, ref) => {
  const baseClasses = cn(
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#030712] disabled:opacity-50 disabled:cursor-not-allowed',
    glow && 'shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]'
  );

  const variantClasses = {
    primary: 'btn-primary-glow', // Mapped to new CSS class
    secondary: 'border border-primary/50 text-primary hover:bg-primary/10 hover:shadow-neon-purple',
    outline: 'border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white',
    ghost: 'text-gray-400 hover:bg-white/5 hover:text-white',
    danger: 'bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20 hover:shadow-lg',
    neon: 'btn-neon', // New neon variant
    glass: 'bg-white/5 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/20 shadow-glass'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className
  );

  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={classes}
      disabled={disabled || isLoading}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(props as any)}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      )}
      {!isLoading && leftIcon && (
        <span className="mr-2">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && (
        <span className="ml-2">{rightIcon}</span>
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';