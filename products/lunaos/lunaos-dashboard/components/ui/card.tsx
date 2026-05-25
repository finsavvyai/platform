import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'solid';
    hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'glass', hover = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'rounded-xl p-6',
                    {
                        glass: 'glass-card',
                        default: 'bg-neutral-900 border border-neutral-800',
                        solid: 'bg-neutral-800',
                    }[variant],
                    hover && 'transition-all hover:-translate-y-1 hover:shadow-glow cursor-pointer',
                    className
                )}
                {...props}
            />
        );
    }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />
    )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('text-lg font-semibold text-white', className)} {...props} />
    )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-sm text-neutral-400', className)} {...props} />
    )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={cn('', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex items-center mt-4 pt-4 border-t border-neutral-800', className)} {...props} />
    )
);
CardFooter.displayName = 'CardFooter';
