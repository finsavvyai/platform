import React from 'react';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { useTheme } from '../theme/useTheme';

type CardVariant = 'outlined' | 'filled';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'outlined', children, ...props }, ref) => {
    const { theme } = useTheme();
    const colorScheme = colors[theme];

    const baseStyle: React.CSSProperties = {
      padding: spacing[4],
      borderRadius: '12px',
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    };

    const variantStyles: Record<CardVariant, React.CSSProperties> = {
      outlined: {
        border: `1px solid ${colorScheme.border}`,
        backgroundColor: colorScheme.background,
      },
      filled: {
        border: 'none',
        backgroundColor:
          theme === 'light' ? colorScheme.gray1 : colorScheme.gray2,
      },
    };

    return (
      <div
        ref={ref}
        style={{
          ...baseStyle,
          ...variantStyles[variant],
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
