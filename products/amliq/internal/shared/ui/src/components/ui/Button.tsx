/**
 * FinSavvy AI Button Component
 * Apple HIG-inspired button with smooth animations and multiple variants
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary button with gradient
        primary: 'bg-gradient-to-r from-brand-cyan-500 via-brand-blue-500 to-brand-indigo-500 text-white shadow-lg hover:shadow-xl hover:shadow-glow-cyan active:scale-95 disabled:shadow-none',

        // Secondary button with glass morphism
        secondary: 'glass-morphism text-foreground border border-white/10 hover:glass-morphism-hover active:scale-95',

        // Outline button
        outline: 'border border-white/20 text-foreground hover:bg-white/10 hover:border-white/30 active:scale-95',

        // Ghost button
        ghost: 'text-foreground hover:bg-white/5 hover:text-white active:scale-95',

        // Destructive button
        destructive: 'bg-semantic-error text-white shadow-lg hover:bg-semantic-error/90 hover:shadow-xl active:scale-95',

        // Success button
        success: 'bg-semantic-success text-white shadow-lg hover:bg-semantic-success/90 hover:shadow-xl active:scale-95',

        // Warning button
        warning: 'bg-semantic-warning text-black shadow-lg hover:bg-semantic-warning/90 hover:shadow-xl active:scale-95',

        // Link style button
        link: 'text-brand-cyan-400 underline-offset-4 hover:underline hover:text-brand-cyan-300 active:scale-95',

        // Gradient text only button
        'gradient-text': 'bg-transparent text-transparent gradient-text hover:opacity-80 active:scale-95',
      },
      size: {
        xs: 'h-8 px-3 text-xs',
        sm: 'h-9 px-4 text-sm',
        md: 'h-10 px-6 text-sm',
        lg: 'h-12 px-8 text-base',
        xl: 'h-14 px-10 text-lg',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
      loading: {
        true: 'cursor-not-allowed',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
      loading: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  ripple?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    fullWidth,
    loading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    ripple = true,
    asChild = false,
    disabled,
    children,
    onClick,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number; size: number }>>([]);

    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!ripple || loading || disabled) return;

      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;

      const newRipple = {
        id: Date.now(),
        x,
        y,
        size,
      };

      setRipples(prev => [...prev, newRipple]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 600);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(event);
      onClick?.(event);
    };

    const renderIcon = () => {
      if (!icon) return null;

      if (loading) {
        return <Loader2 className="h-4 w-4 animate-spin" />;
      }

      return <span className="h-4 w-4">{icon}</span>;
    };

    const renderContent = () => {
      if (loading) {
        return (
          <>
            {renderIcon()}
            <span>{loadingText || 'Loading...'}</span>
          </>
        );
      }

      return (
        <>
          {iconPosition === 'left' && renderIcon()}
          <span>{children}</span>
          {iconPosition === 'right' && renderIcon()}
        </>
      );
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, loading, className }))}
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        <span className="relative overflow-hidden">
          {renderContent()}
          {ripple && (
            <span className="absolute inset-0">
              {ripples.map(ripple => (
                <motion.span
                  key={ripple.id}
                  className="absolute bg-white/20 rounded-full pointer-events-none"
                  style={{
                    left: ripple.x,
                    top: ripple.y,
                    width: ripple.size,
                    height: ripple.size,
                  }}
                  initial={{
                    scale: 0,
                    opacity: 0.5,
                  }}
                  animate={{
                    scale: 4,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.6,
                    ease: 'ease-out',
                  }}
                />
              ))}
            </span>
          )}
        </span>
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };