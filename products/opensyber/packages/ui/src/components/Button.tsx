import { type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'border border-neutral-700 hover:bg-neutral-800 text-neutral-300',
  danger: 'bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-400',
  ghost: 'hover:bg-neutral-800 text-neutral-400 hover:text-white',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        ),
      )}
    >
      {loading ? (
        <span className="animate-spin h-3 w-3 border border-current rounded-full border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
