import React from 'react';
import { cn } from '../../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    hover?: boolean;
    variant?: 'default' | 'glass' | 'holographic' | 'flat' | 'gradient' | 'neon' | 'elevated';
    header?: React.ReactNode;
    footer?: React.ReactNode;
    loading?: boolean;
    interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className,
    padding = 'md',
    hover = false,
    variant = 'default',
    header,
    footer,
    loading = false,
    interactive = false,
    ...props
}) => {
    const paddingClasses = {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10'
    };

    const variantClasses = {
        default: 'bg-[#0B1121] border border-white/10 shadow-lg',
        glass: 'card-glass backdrop-blur-xl bg-white/5 border border-white/10',
        holographic: 'card-holographic bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-cyan-500/10 border border-white/20',
        flat: 'bg-[#0B1121]',
        gradient: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/5',
        neon: 'bg-[#0B1121] border border-primary/50 shadow-[0_0_30px_rgba(0,240,255,0.15)]',
        elevated: 'bg-[#0F172A] shadow-2xl shadow-black/50 border border-white/5'
    };

    const hoverClasses = hover ? 'hover:shadow-neon hover:border-primary/40 cursor-pointer hover:translate-y-[-2px]' : '';
    const interactiveClasses = interactive ? 'cursor-pointer active:scale-[0.98] transition-transform' : '';

    return (
        <div
            className={cn(
                'rounded-xl transition-all duration-300 relative overflow-hidden',
                variantClasses[variant],
                hoverClasses,
                interactiveClasses,
                loading && 'pointer-events-none',
                className
            )}
            {...props}
        >
            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-white/70">Loading...</span>
                    </div>
                </div>
            )}

            {/* Header */}
            {header && (
                <div className={cn(
                    'border-b border-white/10',
                    padding !== 'none' && paddingClasses[padding]
                )}>
                    {header}
                </div>
            )}

            {/* Content */}
            <div className={cn(
                header || footer ? '' : paddingClasses[padding],
                header && footer ? paddingClasses[padding] : '',
                header && !footer ? paddingClasses[padding] : '',
                !header && footer ? paddingClasses[padding] : ''
            )}>
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className={cn(
                    'border-t border-white/10',
                    padding !== 'none' && paddingClasses[padding]
                )}>
                    {footer}
                </div>
            )}
        </div>
    );
};
