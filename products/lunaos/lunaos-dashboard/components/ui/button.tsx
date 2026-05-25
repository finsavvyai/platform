import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                primary:
                    'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5',
                secondary:
                    'bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30',
                ghost: 'text-neutral-400 hover:text-white hover:bg-white/5',
                danger:
                    'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/25',
                outline:
                    'border border-primary-500/50 text-primary-400 hover:bg-primary-500/10 hover:border-primary-500',
                link: 'text-primary-400 underline-offset-4 hover:underline',
            },
            size: {
                sm: 'h-9 px-3 text-sm',
                md: 'h-10 px-4 text-sm',
                lg: 'h-12 px-6 text-base',
                xl: 'h-14 px-8 text-lg',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : leftIcon ? (
                    leftIcon
                ) : null}
                {children}
                {!isLoading && rightIcon}
            </button>
        );
    }
);
Button.displayName = 'Button';
