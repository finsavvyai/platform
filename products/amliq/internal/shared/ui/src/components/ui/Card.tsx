/**
 * FinSavvy AI Card Component
 * Apple HIG-inspired card with glass morphism and interactive effects
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const cardVariants = cva(
  'relative rounded-2xl border bg-background/95 backdrop-blur-xl transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'border-white/10 shadow-xl hover:shadow-2xl hover:border-white/20 hover:bg-background/98',
        glass: 'glass-morphism border-white/10 shadow-xl hover:glass-morphism-hover hover:shadow-2xl',
        elevated: 'bg-background border-white/10 shadow-2xl hover:shadow-3xl hover:border-white/15 hover:translate-y-[-2px]',
        flat: 'bg-background/50 border-white/5 shadow-sm hover:border-white/10 hover:bg-background/70',
        outline: 'bg-transparent border-white/20 shadow-none hover:bg-white/5 hover:shadow-lg',
        gradient: 'bg-gradient-to-br from-brand-cyan/10 via-brand-blue/10 to-brand-indigo/10 border-white/20 shadow-xl hover:shadow-2xl',
        interactive: 'border-white/10 shadow-xl hover:shadow-2xl hover:border-white/20 hover:bg-background/98 cursor-pointer active:scale-95',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-lg',
        md: 'rounded-xl',
        lg: 'rounded-2xl',
        xl: 'rounded-3xl',
        full: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      padding: 'none',
      rounded: 'lg',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
  interactive?: boolean;
  hover?: boolean;
  loading?: boolean;
  shimmer?: boolean;
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  shimmer?: boolean;
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  shimmer?: boolean;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
  noPadding?: boolean;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, padding, rounded, interactive, hover = true, loading, shimmer, asChild = false, ...props }, ref) => {
    const Component = asChild ? 'div' : 'div';

    return (
      <motion.div
        className={cn(
          cardVariants({ variant, size, padding, rounded }),
          interactive && 'cursor-pointer',
          hover && !interactive && 'hover:shadow-2xl',
          loading && 'opacity-70 pointer-events-none',
          className
        )}
        ref={ref}
        whileHover={hover && !loading ? { scale: 1.02 } : undefined}
        whileTap={interactive && !loading ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        {...props}
      >
        {shimmer && <ShimmerOverlay />}
        {props.children}
      </motion.div>
    );
  }
);

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, shimmer, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6 pb-4', shimmer && 'relative overflow-hidden', className)}
      {...props}
    >
      {shimmer && <ShimmerOverlay />}
      {children}
    </div>
  )
);

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = 'h3', shimmer, children, ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(
        'text-2xl font-semibold leading-none tracking-tight text-foreground',
        shimmer && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {shimmer && <ShimmerOverlay />}
      {children}
    </Tag>
  )
);

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, shimmer, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        'text-sm text-foreground-secondary leading-relaxed',
        shimmer && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {shimmer && <ShimmerOverlay />}
      {children}
    </p>
  )
);

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, shimmer, noPadding = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        noPadding ? '' : 'p-6 pt-0',
        shimmer && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {shimmer && <ShimmerOverlay />}
      {children}
    </div>
  )
);

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, shimmer, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center p-6 pt-0',
        shimmer && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {shimmer && <ShimmerOverlay />}
      {children}
    </div>
  )
);

// Shimmer overlay component for loading states
function ShimmerOverlay() {
  return (
    <div className="absolute inset-0 -z-10">
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

// Gradient border component for enhanced visual appeal
function GradientBorder({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative p-[2px] rounded-2xl bg-gradient-to-r from-brand-cyan-500 via-brand-blue-500 to-brand-indigo-500', className)}>
      <div className="relative rounded-2xl bg-background/95 backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}

// Card with animated gradient border
function GradientCard({
  children,
  className,
  ...props
}: CardProps & { children: React.ReactNode }) {
  return (
    <GradientBorder className={className}>
      <Card
        variant="flat"
        padding="md"
        {...props}
      >
        {children}
      </Card>
    </GradientBorder>
  );
}

// Stats card component
function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  className,
  ...props
}: {
  title: string;
  value: string | number;
  change?: string | number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
} & CardProps) {
  const changeColor = {
    positive: 'text-semantic-success',
    negative: 'text-semantic-error',
    neutral: 'text-foreground-secondary',
  }[changeType];

  return (
    <Card
      variant="interactive"
      size="md"
      className={className}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground-secondary">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {change && (
            <p className={cn('text-sm font-medium', changeColor)}>
              {changeType === 'positive' && '↑ '}
              {changeType === 'negative' && '↓ '}
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-cyan-500/20 to-brand-indigo-500/20 flex items-center justify-center text-brand-cyan-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// Loading skeleton card
function SkeletonCard({
  lines = 3,
  className
}: {
  lines?: number;
  className?: string
}) {
  return (
    <Card
      variant="default"
      size="md"
      loading
      className={className}
    >
      <div className="space-y-4">
        <div className="h-6 bg-white/10 rounded-lg animate-pulse" />
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-white/5 rounded animate-pulse"
            style={{ width: `${Math.random() * 40 + 60}%` }}
          />
        ))}
      </div>
    </Card>
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  GradientCard,
  StatsCard,
  SkeletonCard,
};