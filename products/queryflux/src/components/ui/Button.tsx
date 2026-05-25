import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 touch-target',
          {
            'premium-button bg-primary text-primary-foreground hover:bg-primary/90':
              variant === 'default',
            'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90':
              variant === 'destructive',
            'border border-input bg-background shadow-sm hover:border-primary/50 hover:bg-primary/10 hover:text-foreground':
              variant === 'outline',
            'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80':
              variant === 'secondary',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
            'text-primary underline-offset-4 hover:underline': variant === 'link',
          },
          {
            'h-11 px-8': size === 'default',
            'h-9 rounded-lg px-3 text-xs': size === 'sm',
            'h-12 rounded-xl px-8': size === 'lg',
            'h-11 w-11': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
