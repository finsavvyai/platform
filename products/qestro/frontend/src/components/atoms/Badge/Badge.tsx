import React from 'react';
import { cn } from '../../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'neon' | 'gradient' | 'pulse' | 'glass';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  animated?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  removable = false,
  onRemove,
  animated = false,
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-300';

  const variantClasses = {
    primary: 'bg-primary/20 text-primary border border-primary/20 hover:bg-primary/30',
    secondary: 'bg-slate-700 text-slate-300 hover:bg-slate-600',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:bg-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30',
    outline: 'bg-transparent border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300',
    neon: 'bg-transparent border border-primary text-primary shadow-neon hover:shadow-[0_0_20px_rgba(0,240,255,0.5)]',
    gradient: 'bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 text-white border border-white/10',
    pulse: 'bg-primary/20 text-primary border border-primary/30 animate-pulse',
    glass: 'bg-white/5 backdrop-blur-md border border-white/10 text-white/90 hover:bg-white/10',
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        animated && 'hover:scale-105',
        className
      )}
    >
      {icon && <span className={cn('flex-shrink-0', iconSizes[size])}>{icon}</span>}
      {children}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:text-white transition-colors focus:outline-none"
          aria-label="Remove"
        >
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};