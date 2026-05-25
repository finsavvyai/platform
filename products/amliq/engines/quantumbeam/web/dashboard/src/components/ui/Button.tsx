import React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  loading?: boolean
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, disabled, children, ...props }, ref) => {
    const baseClasses = [
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'transition-all duration-200 ease-in-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'select-none',
    ]

    const variants = {
      default: [
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'shadow-sm hover:shadow-md',
      ],
      primary: [
        'bg-quantum-600 text-white hover:bg-quantum-700',
        'shadow-apple hover:shadow-apple-lg',
        'border border-quantum-500',
      ],
      secondary: [
        'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        'border border-border',
      ],
      ghost: [
        'hover:bg-accent hover:text-accent-foreground',
        'text-muted-foreground',
      ],
      destructive: [
        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        'shadow-sm hover:shadow-md',
      ],
      outline: [
        'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        'shadow-sm',
      ],
    }

    const sizes = {
      default: ['h-10 px-4 py-2'],
      sm: ['h-9 rounded-md px-3'],
      lg: ['h-11 rounded-md px-8'],
      icon: ['h-10 w-10'],
    }

    const classes = cn(
      baseClasses,
      variants[variant],
      sizes[size],
      className
    )

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }