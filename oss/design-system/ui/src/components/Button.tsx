import React from 'react';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { useTheme } from '../theme/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();
    const colorScheme = colors[theme];

    const baseStyles: React.CSSProperties = {
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
      fontWeight: 600,
      border: 'none',
      borderRadius: '8px',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.5 : 1,
      transition: 'all 0.2s ease',
    };

    const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
      sm: {
        padding: `${spacing[1]} ${spacing[3]}`,
        fontSize: '12px',
      },
      md: {
        padding: `${spacing[2]} ${spacing[4]}`,
        fontSize: '14px',
      },
      lg: {
        padding: `${spacing[3]} ${spacing[5]}`,
        fontSize: '16px',
      },
    };

    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        backgroundColor: colorScheme.primary,
        color: '#FFFFFF',
      },
      secondary: {
        backgroundColor: colorScheme.secondary,
        color: '#FFFFFF',
      },
      outline: {
        backgroundColor: 'transparent',
        color: colorScheme.primary,
        border: `1px solid ${colorScheme.primary}`,
      },
      ghost: {
        backgroundColor: 'transparent',
        color: colorScheme.primary,
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          ...baseStyles,
          ...sizeStyles[size],
          ...variantStyles[variant],
        }}
        {...props}
      >
        {loading ? 'Loading...' : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
