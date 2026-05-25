import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
        const inputId = id || React.useId();

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-neutral-300 mb-1.5"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        type={type}
                        id={inputId}
                        className={cn(
                            'flex h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-500 transition-all',
                            'focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
                {hint && !error && <p className="mt-1.5 text-sm text-neutral-500">{hint}</p>}
            </div>
        );
    }
);
Input.displayName = 'Input';
