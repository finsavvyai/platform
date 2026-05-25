import React, { forwardRef } from 'react';
import { cn } from '../../../lib/utils';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'outline' | 'glass';
  inputSize?: 'sm' | 'md' | 'lg';
  isPassword?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  inputSize = 'md',
  isPassword = false,
  className,
  type,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);


  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const baseClasses = 'w-full transition-all duration-300 focus:outline-none focus:ring-1';

  const variantClasses = {
    default: 'input-glass', // Use glass as default now
    filled: 'border-0 rounded-lg bg-white/5 text-white placeholder:text-gray-500 focus:ring-primary focus:bg-white/10',
    outline: 'border border-white/20 rounded-lg bg-transparent text-white placeholder:text-gray-500 focus:ring-primary focus:border-primary',
    glass: 'input-glass'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-base'
  };

  const errorClasses = error ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' : '';

  const inputClasses = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[inputSize],
    errorClasses,
    leftIcon && 'pl-10',
    (rightIcon || isPassword) && 'pr-10',
    className
  );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-white mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500">{leftIcon}</span>
          </div>
        )}

        <input
          ref={ref}
          type={inputType}
          className={inputClasses}

          {...props}
        />

        {(rightIcon || isPassword || error) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {error && (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            {isPassword && !error && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-500 hover:text-gray-400 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            )}
            {rightIcon && !isPassword && !error && (
              <span className="text-gray-500">{rightIcon}</span>
            )}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <div className="mt-2">
          {error && (
            <p className="text-sm text-red-400 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error}
            </p>
          )}
          {helperText && !error && (
            <p className="text-sm text-gray-400">{helperText}</p>
          )}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';