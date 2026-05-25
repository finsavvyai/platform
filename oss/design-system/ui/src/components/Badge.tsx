import React from 'react';
import { colors, ColorKey } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { useTheme } from '../theme/useTheme';

type BadgeVariant = 'solid' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  color?: ColorKey;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'solid',
  color = 'primary',
  children,
  ...props
}) => {
  const { theme } = useTheme();
  const colorScheme = colors[theme];
  const colorValue =
    colorScheme[color] || colorScheme.primary;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    padding: `${spacing[1]} ${spacing[2]}`,
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    whiteSpace: 'nowrap',
  };

  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    solid: {
      backgroundColor: colorValue,
      color: '#FFFFFF',
    },
    outline: {
      backgroundColor: 'transparent',
      color: colorValue,
      border: `1px solid ${colorValue}`,
    },
  };

  return (
    <span
      style={{
        ...baseStyle,
        ...variantStyles[variant],
      }}
      {...props}
    >
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';
