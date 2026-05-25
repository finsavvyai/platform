import React from 'react';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  className = ''
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  return (
    <div
      className={cn(
        "w-full bg-gray-200 rounded-full",
        sizeClasses[size],
        className
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-valuemin={0}
    >
      <div
        className={cn(
          colorClasses[color],
          sizeClasses[size],
          "rounded-full transition-all duration-300 ease-out"
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};