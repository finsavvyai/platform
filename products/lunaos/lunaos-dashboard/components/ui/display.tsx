import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ========================================
// BADGE
// ========================================

const badgeVariants = cva(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
    {
        variants: {
            variant: {
                default: 'bg-white/10 text-neutral-300 border border-white/10',
                primary: 'bg-primary-500/10 text-primary-400 border border-primary-500/20',
                secondary: 'bg-neutral-800 text-neutral-300',
                success: 'bg-green-500/10 text-green-400 border border-green-500/20',
                warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
                outline: 'border border-neutral-700 text-neutral-300',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant, ...props }, ref) => {
        return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
    }
);
Badge.displayName = 'Badge';

// ========================================
// AVATAR
// ========================================

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    src?: string;
    alt?: string;
    fallback?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
    ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
        const [hasError, setHasError] = React.useState(false);

        const sizeClasses = {
            sm: 'h-8 w-8 text-xs',
            md: 'h-10 w-10 text-sm',
            lg: 'h-12 w-12 text-base',
            xl: 'h-16 w-16 text-lg',
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'relative flex shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-accent-500',
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                {src && !hasError ? (
                    <img
                        src={src}
                        alt={alt}
                        className="aspect-square h-full w-full object-cover"
                        onError={() => setHasError(true)}
                    />
                ) : (
                    <span className="flex h-full w-full items-center justify-center font-medium text-white">
                        {fallback || '?'}
                    </span>
                )}
            </div>
        );
    }
);
Avatar.displayName = 'Avatar';

// ========================================
// SKELETON
// ========================================

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
    ({ className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn('animate-pulse rounded-md bg-white/10', className)}
                {...props}
            />
        );
    }
);
Skeleton.displayName = 'Skeleton';

// ========================================
// SEPARATOR
// ========================================

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
    orientation?: 'horizontal' | 'vertical';
}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
    ({ className, orientation = 'horizontal', ...props }, ref) => {
        return (
            <hr
                ref={ref}
                className={cn(
                    'border-0 bg-white/10',
                    orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
                    className
                )}
                {...props}
            />
        );
    }
);
Separator.displayName = 'Separator';

// ========================================
// SPINNER
// ========================================

export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    return (
        <Loader2 className={cn('animate-spin text-primary-500', sizeClasses[size], className)} />
    );
};
